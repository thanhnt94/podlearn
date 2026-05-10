from typing import Callable, Any, Optional
from fastapi import BackgroundTasks
from .config import settings
import threading
import logging

logger = logging.getLogger(__name__)

class BaseTaskRunner:
    def run(self, func: Callable, *args, **kwargs) -> Any:
        raise NotImplementedError

class CeleryTaskRunner(BaseTaskRunner):
    def __init__(self, fallback_tasks: Optional[BackgroundTasks] = None):
        self.fallback_tasks = fallback_tasks

    def run(self, func: Callable, *args, **kwargs) -> Any:
        # Assuming func is a celery task object
        if hasattr(func, "delay"):
            try:
                logger.info(f"Dispatching task {getattr(func, '__name__', 'unknown')} via Celery")
                return func.delay(*args, **kwargs)
            except Exception as e:
                logger.error(f"Celery dispatch failed: {e}. Falling back...")
                if self.fallback_tasks:
                    actual_func = getattr(func, "run", func)
                    self.fallback_tasks.add_task(actual_func, *args, **kwargs)
                    return None
                else:
                    # Thread fallback if no BackgroundTasks provided
                    actual_func = getattr(func, "run", func)
                    thread = threading.Thread(target=actual_func, args=args, kwargs=kwargs)
                    thread.start()
                    return thread
        else:
            logger.warning(f"Function {getattr(func, '__name__', 'unknown')} is not a Celery task, running in thread fallback")
            thread = threading.Thread(target=func, args=args, kwargs=kwargs)
            thread.start()
            return thread

class BackgroundTaskRunner(BaseTaskRunner):
    def __init__(self, background_tasks: BackgroundTasks):
        self.background_tasks = background_tasks

    def run(self, func: Callable, *args, **kwargs) -> Any:
        logger.info(f"Dispatching task {getattr(func, '__name__', 'unknown')} via FastAPI BackgroundTasks")
        # If it's a celery task object, we need to call the underlying function
        actual_func = getattr(func, "run", func)
        self.background_tasks.add_task(actual_func, *args, **kwargs)
        return None

def get_task_runner(background_tasks: Optional[BackgroundTasks] = None) -> BaseTaskRunner:
    from app.modules.engagement.models import AppSetting
    runner_mode = AppSetting.get('TASK_RUNNER', settings.TASK_RUNNER)

    if runner_mode == "celery":
        return CeleryTaskRunner(fallback_tasks=background_tasks)
    
    if background_tasks is not None:
        return BackgroundTaskRunner(background_tasks)
    
    # Fallback for non-request contexts
    class ThreadTaskRunner(BaseTaskRunner):
        def run(self, func: Callable, *args, **kwargs) -> Any:
            actual_func = getattr(func, "run", func)
            thread = threading.Thread(target=actual_func, args=args, kwargs=kwargs)
            thread.start()
            return thread
            
    return ThreadTaskRunner()

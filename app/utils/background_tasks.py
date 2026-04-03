import threading
from flask import current_app

def run_in_background(target_func, *args, **kwargs):
    """
    Runs a function in a background thread with Flask application context.
    Usage: run_in_background(my_heavy_task, arg1, kwarg1='value')
    """
    app = current_app._get_current_object()

    def thread_wrapper():
        with app.app_context():
            try:
                target_func(*args, **kwargs)
            except Exception as e:
                app.logger.error(f"Background task failed: {str(e)}")

    thread = threading.Thread(target=thread_wrapper)
    thread.daemon = True
    thread.start()
    return thread

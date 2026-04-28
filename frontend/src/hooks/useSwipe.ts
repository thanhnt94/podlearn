import { useState, type TouchEvent } from 'react';

interface SwipeInput {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    threshold?: number;
}

export const useSwipe = (input: SwipeInput) => {
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [touchYStart, setTouchYStart] = useState<number | null>(null);
    const [touchYEnd, setTouchYEnd] = useState<number | null>(null);

    const minSwipeDistance = input.threshold || 50;

    const onTouchStart = (e: TouchEvent) => {
        setTouchEnd(null);
        setTouchYEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        setTouchYStart(e.targetTouches[0].clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
        setTouchYEnd(e.targetTouches[0].clientY);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd || !touchYStart || !touchYEnd) return;
        
        const distanceX = touchStart - touchEnd;
        const isLeftSwipe = distanceX > minSwipeDistance;
        const isRightSwipe = distanceX < -minSwipeDistance;

        const distanceY = touchYStart - touchYEnd;
        const isUpSwipe = distanceY > minSwipeDistance;
        const isDownSwipe = distanceY < -minSwipeDistance;

        // Priority to the axis with more distance
        if (Math.abs(distanceX) > Math.abs(distanceY)) {
            if (isLeftSwipe && input.onSwipeLeft) input.onSwipeLeft();
            if (isRightSwipe && input.onSwipeRight) input.onSwipeRight();
        } else {
            if (isUpSwipe && input.onSwipeUp) input.onSwipeUp();
            if (isDownSwipe && input.onSwipeDown) input.onSwipeDown();
        }
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd
    };
};

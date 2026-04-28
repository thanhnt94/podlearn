// Subtitle Processing Worker
self.onmessage = (e: MessageEvent) => {
    const { type, data } = e.data;

    if (type === 'PARSE_SUBTITLES') {
        const { rawJson } = data;
        // Offload heavy processing here
        // For now, just a pass-through simulation with a slight delay
        const startTime = performance.now();
        
        // Simulating heavy work (e.g. indexing, keyword extraction)
        const processed = rawJson.map((line: any, index: number) => ({
            ...line,
            index,
            searchKey: line.text.toLowerCase().replace(/[^\w\s]/g, '')
        }));

        const duration = performance.now() - startTime;
        console.log(`[Worker] Subtitle parsing took ${duration.toFixed(2)}ms`);

        self.postMessage({ type: 'PARSE_SUBTITLES_COMPLETE', data: processed });
    }
};

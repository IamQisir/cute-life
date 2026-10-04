import { bakeWelcome, frameBytes, type BakeMessage } from './welcomeBake';

// Keep this module independent of DOM/Pixi; Vite emits a separate module worker chunk.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<{ preferSmall: boolean }>) => void) | null;
  postMessage(message: BakeMessage, transfer?: Transferable[]): void;
};
worker.onmessage = (event) => {
  // Quality only ever steps down, so a show that starts small never needs the
  // full world: phones bake ~9.5 MiB instead of ~32 MiB.
  const variants = event.data.preferSmall ? [true] : [false, true];
  const jobs = variants.map((small) => ({
    small, iterator: bakeWelcome(small), bytes: 0, ms: 0,
  }));
  // Interleave generation ages so the small fallback is ready at the 6s cut even
  // on phones. The preferred variant's initial scene is always transferred first.
  while (jobs.length) {
    for (const job of [...jobs]) {
      const start = performance.now();
      const next = job.iterator.next();
      job.ms += performance.now() - start;
      if (next.done) {
        worker.postMessage({ small: job.small, bytes: job.bytes, ms: job.ms });
        jobs.splice(jobs.indexOf(job), 1);
      } else {
        const frame = next.value;
        job.bytes += frameBytes(frame);
        worker.postMessage({ small: job.small, frame }, [frame.cells.buffer, frame.counts.buffer]);
      }
    }
  }
};

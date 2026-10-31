"""Background execution: AI generation and publishing run off the request thread."""
import logging
from concurrent.futures import ThreadPoolExecutor

log = logging.getLogger("loop.jobs")
executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="loop-job")


def submit(fn, *args, **kwargs):
    def run():
        try:
            fn(*args, **kwargs)
        except Exception:
            log.exception("background job %s failed", getattr(fn, "__name__", fn))

    return executor.submit(run)

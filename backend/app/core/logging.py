"""Structured logging configuration.

Never log secrets: passwords, bearer tokens, service-role keys. Callers
should pass identifiers (inspection_id, image_id, user_id) as structured
fields rather than interpolating them into free-text messages.
"""

import logging
import sys

import structlog


def configure_logging(api_env: str) -> None:
    log_level = logging.DEBUG if api_env != "production" else logging.INFO

    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=log_level)

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    renderer: structlog.types.Processor = (
        structlog.processors.JSONRenderer() if api_env == "production" else structlog.dev.ConsoleRenderer()
    )

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    return structlog.get_logger(name)

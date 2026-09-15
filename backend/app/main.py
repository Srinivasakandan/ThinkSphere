"""FastAPI application factory and wiring.

Keeps main.py thin: configuration, middleware, routers and error
handlers only — no business logic lives here.
"""

import uuid

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    auth,
    dashboard,
    extraction,
    health,
    images,
    inspections,
    processing,
    reports,
    review,
    rules,
)
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.services.processing_service import ProcessingError

settings = get_settings()
configure_logging(settings.api_env)
logger = get_logger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        description=(
            "Inspection-assistance API for Legal Metrology (Packaged Commodities) Rules, 2011 "
            "compliance checks. Findings are system-detected signals, not legal determinations — "
            "the inspector remains the final verifier."
        ),
    )

    # Wildcard origins are never used, in dev or production — they are
    # incompatible with allow_credentials=True in any case. Add further
    # trusted origins to FRONTEND_URL(S) as a comma-separated value if
    # ever needed.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response

    app.mount("/media", StaticFiles(directory=settings.local_storage_dir, check_dir=False), name="media")

    for router in (
        health.router,
        auth.router,
        inspections.router,
        images.router,
        processing.router,
        extraction.router,
        rules.router,
        review.router,
        dashboard.router,
        reports.router,
    ):
        app.include_router(router)

    register_exception_handlers(app)
    return app


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict) and "error" in detail:
            body = detail
        else:
            body = {"error": {"code": "HTTP_ERROR", "message": str(detail)}}
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "The request could not be validated.",
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(ProcessingError)
    async def processing_error_handler(request: Request, exc: ProcessingError) -> JSONResponse:
        logger.error("processing_failed", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"error": {"code": "PROCESSING_FAILED", "message": "Inspection processing failed."}},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.error("unhandled_exception", error=str(exc), path=request.url.path, request_id=request_id)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."}},
        )


app = create_app()

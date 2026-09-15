"""Extraction orchestrator: combines OCR text from every image in an
inspection into structured fields.

    OCR results (per image)
        v
    Regex extraction + Context extraction (per image)
        v
    Merge candidates across ALL images for the inspection
        v
    Conflict resolution
        v
    Confidence combination
        v
    ExtractionResult per field  (validation happens separately)

A declaration may appear on one image while a different declaration
for the same product appears on another — extraction therefore always
operates across the whole inspection, never a single image in
isolation.
"""

from collections import defaultdict

from app.services.extraction import nlp_extractor, regex_extractor
from app.services.extraction.candidate import (
    ConflictCandidate,
    ExtractionCandidate,
    ExtractionResult,
    ImageOCRInput,
)
from app.utils.confidence import combine_scores


def _cluster_key(candidate: ExtractionCandidate) -> str:
    key = candidate.normalized_value or candidate.value
    return key.strip().lower()


def _resolve_field(
    field_name: str,
    candidates: list[ExtractionCandidate],
    ocr_confidence_by_image: dict,
) -> ExtractionResult:
    clusters: dict[str, list[ExtractionCandidate]] = defaultdict(list)
    for candidate in candidates:
        clusters[_cluster_key(candidate)].append(candidate)

    if len(clusters) == 1:
        (cluster,) = clusters.values()
        best = max(cluster, key=lambda c: c.confidence)
        ocr_conf = ocr_confidence_by_image.get(best.source_image_id, best.confidence)
        # Corroboration across multiple images/methods raises confidence;
        # a single weak signal does not.
        corroboration_bonus = 0.05 * (len(cluster) - 1)
        final_confidence = combine_scores(best.confidence, ocr_conf) + corroboration_bonus
        return ExtractionResult(
            field_name=field_name,
            value=best.value,
            normalized_value=best.normalized_value,
            confidence=max(0.0, min(1.0, final_confidence)),
            source_image_id=best.source_image_id,
            source_text=best.source_text,
            has_conflict=False,
            conflict_values=[],
        )

    # Genuine conflict: different images disagree on this field's value.
    # Never silently pick a winner — surface every candidate with its
    # source image for inspector review.
    best_overall = max(candidates, key=lambda c: c.confidence)
    distinct_values = sorted({c.value for c in candidates})
    seen_values: set[str] = set()
    candidate_list: list[ConflictCandidate] = []
    for candidate in sorted(candidates, key=lambda c: c.confidence, reverse=True):
        if candidate.value in seen_values:
            continue
        seen_values.add(candidate.value)
        candidate_list.append(
            ConflictCandidate(value=candidate.value, source_image_id=candidate.source_image_id)
        )
    return ExtractionResult(
        field_name=field_name,
        value=best_overall.value,
        normalized_value=best_overall.normalized_value,
        confidence=0.3,
        source_image_id=best_overall.source_image_id,
        source_text=best_overall.source_text,
        has_conflict=True,
        conflict_values=distinct_values,
        candidates=candidate_list,
    )


def extract_product_information(images: list[ImageOCRInput]) -> list[ExtractionResult]:
    all_candidates: list[ExtractionCandidate] = []
    ocr_confidence_by_image = {}

    for image in images:
        ocr_confidence_by_image[image.image_id] = image.ocr_confidence
        all_candidates.extend(regex_extractor.extract(image.raw_text, image.image_id))
        all_candidates.extend(nlp_extractor.extract(image.raw_text, image.image_id, image.view_type))

    grouped: dict[str, list[ExtractionCandidate]] = defaultdict(list)
    for candidate in all_candidates:
        grouped[candidate.field_name].append(candidate)

    return [
        _resolve_field(field_name, candidates, ocr_confidence_by_image)
        for field_name, candidates in grouped.items()
    ]

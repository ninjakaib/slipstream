"""OpenAPI spec generation commands."""

import json
from pathlib import Path

import click


@click.command()
@click.option(
    "-o",
    "--output",
    type=click.Path(dir_okay=False, writable=True, path_type=Path),
    default=None,
    help="Output file path. Defaults to stdout.",
)
@click.option(
    "--clean-operation-ids/--no-clean-operation-ids",
    default=True,
    help="Remove tag prefix from operation IDs for cleaner SDK method names.",
)
def openapi(output: Path | None, clean_operation_ids: bool) -> None:
    """Generate the OpenAPI specification from the FastAPI app."""
    from backend.main import app

    spec = app.openapi()

    if clean_operation_ids:
        spec = _clean_operation_ids(spec)

    spec_json = json.dumps(spec, indent=2) + "\n"

    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(spec_json)
        click.echo(f"OpenAPI spec written to {output}")
    else:
        click.echo(spec_json)


def _clean_operation_ids(spec: dict) -> dict:
    """Remove tag prefix from operation IDs for cleaner generated SDK method names.

    FastAPI generates operation IDs like "auth-register" (tag-function_name).
    This strips the tag prefix so the SDK generates `register()` instead of `authRegister()`,
    since the tag-based grouping already provides namespace separation.
    """
    for path_data in spec.get("paths", {}).values():
        for operation in path_data.values():
            if not isinstance(operation, dict):
                continue
            tags = operation.get("tags", [])
            operation_id = operation.get("operationId")
            if tags and operation_id:
                tag = tags[0]
                prefix = f"{tag}-"
                if operation_id.startswith(prefix):
                    operation["operationId"] = operation_id[len(prefix):]

    return spec

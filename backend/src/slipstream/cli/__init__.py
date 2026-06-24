"""SlipStream backend CLI tools."""

import click

from slipstream.cli.openapi import openapi


@click.group()
def cli() -> None:
    """SlipStream backend management commands."""


cli.add_command(openapi)

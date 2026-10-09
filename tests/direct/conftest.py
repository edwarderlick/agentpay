"""Shared helpers for direct mode tests."""

import json
import os
import sys

import pytest


def _drop_host_genlayer_modules() -> None:
    """Let the contract runner stdlib load as `genlayer`.

    Site-packages ships an off-chain `genlayer` package without
    `gl.contract`. Direct mode inserts the runner stdlib on sys.path
    but keeps the already-imported host module, so contracts fail with
    `module 'genlayer' has no attribute 'contract'`.
    """
    for name in list(sys.modules):
        if name == "genlayer" or name.startswith("genlayer."):
            del sys.modules[name]


@pytest.fixture(autouse=True)
def windows_fd0_tempfile_unlink(monkeypatch):
    """genlayer-test unlinks the fd0 tempfile while stdin still holds it.

    On Windows that raises WinError 32 and aborts deploy. Leave the file;
    the OS reclaims it when the fd closes.
    """
    if sys.platform != "win32":
        yield
        return

    real_unlink = os.unlink

    def unlink_ignore_locked(path):
        try:
            real_unlink(path)
        except PermissionError:
            pass

    monkeypatch.setattr(os, "unlink", unlink_ignore_locked)
    yield


@pytest.fixture(autouse=True)
def isolate_contract_sdk(monkeypatch):
    from gltest.direct.sdk_loader import setup_sdk_paths as original_setup

    def setup_and_drop(*args, **kwargs):
        paths = original_setup(*args, **kwargs)
        _drop_host_genlayer_modules()
        return paths

    monkeypatch.setattr("gltest.direct.sdk_loader.setup_sdk_paths", setup_and_drop)
    _drop_host_genlayer_modules()
    yield


def to_hex(addr_bytes):
    """Convert address bytes to checksummed hex matching contract output.

    The contract's get_bets()/get_points() return keys via Address.as_hex,
    which produces EIP-55 checksummed hex. Call after direct_deploy so the
    SDK is on sys.path.
    """
    if hasattr(addr_bytes, "as_hex"):
        return addr_bytes.as_hex
    from genlayer.types import Address

    return Address(addr_bytes).as_hex


def mock_json_llm(vm, prompt_pattern, response):
    """Register JSON at the direct runner's raw text response boundary."""
    vm.mock_llm(prompt_pattern, json.dumps(json.dumps(response)))

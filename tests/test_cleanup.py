"""
Tests for utils.cleanup module:
  - safe_remove
  - cleanup_files
"""

import os
import pytest
from unittest.mock import patch

from utils.cleanup import safe_remove, cleanup_files


class TestSafeRemove:
    """Tests for safe_remove — file deletion with directory jail."""

    def test_removes_file_inside_temp_dir(self, tmp_dir):
        """Should delete a file that resides inside TEMP_DIR."""
        path = os.path.join(tmp_dir, "test_file.txt")
        with open(path, "w") as f:
            f.write("test")

        with patch("utils.cleanup.Settings") as mock_settings:
            mock_settings.TEMP_DIR = tmp_dir
            safe_remove(path)

        assert not os.path.exists(path)

    def test_refuses_to_remove_outside_temp_dir(self, tmp_dir):
        """Should NOT delete a file outside TEMP_DIR (security)."""
        # Create a file in a different temp directory
        import tempfile
        other_dir = tempfile.mkdtemp(prefix="podforge_other_")
        path = os.path.join(other_dir, "important.txt")
        with open(path, "w") as f:
            f.write("should not be deleted")

        with patch("utils.cleanup.Settings") as mock_settings:
            mock_settings.TEMP_DIR = tmp_dir
            safe_remove(path)

        assert os.path.exists(path)  # File should still be there
        os.remove(path)
        os.rmdir(other_dir)

    def test_handles_nonexistent_file_gracefully(self, tmp_dir):
        """Should not raise when file doesn't exist."""
        with patch("utils.cleanup.Settings") as mock_settings:
            mock_settings.TEMP_DIR = tmp_dir
            safe_remove(os.path.join(tmp_dir, "ghost.txt"))  # Should not raise

    def test_handles_none_path(self):
        """Should not raise when path is None."""
        safe_remove(None)  # Should not raise


class TestCleanupFiles:
    """Tests for cleanup_files — batch deletion."""

    def test_cleans_multiple_files(self, tmp_dir):
        """Should remove all files passed as arguments."""
        paths = []
        for i in range(3):
            p = os.path.join(tmp_dir, f"file_{i}.tmp")
            with open(p, "w") as f:
                f.write(f"data {i}")
            paths.append(p)

        with patch("utils.cleanup.Settings") as mock_settings:
            mock_settings.TEMP_DIR = tmp_dir
            cleanup_files(*paths)

        for p in paths:
            assert not os.path.exists(p)

    def test_handles_mix_of_valid_and_none(self, tmp_dir):
        """Should handle a mix of valid paths and None values."""
        path = os.path.join(tmp_dir, "real_file.tmp")
        with open(path, "w") as f:
            f.write("data")

        with patch("utils.cleanup.Settings") as mock_settings:
            mock_settings.TEMP_DIR = tmp_dir
            cleanup_files(None, path, None)

        assert not os.path.exists(path)

    def test_empty_arguments(self):
        """Should handle being called with no arguments."""
        cleanup_files()  # Should not raise

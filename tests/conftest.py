import pytest
from unittest.mock import MagicMock
import numpy as np

@pytest.fixture(autouse=True)
def mock_sentence_transformer(monkeypatch):
    """
    Mock SentenceTransformer to prevent model downloads during tests.
    Returns a dummy 384-dimensional vector (standard for all-MiniLM-L6-v2).
    """
    # Create a mock model instance
    mock_model = MagicMock()
    mock_model.encode.return_value = np.zeros((384,), dtype=np.float32)

    # Mock the class constructor to return our mock_model
    mock_class = MagicMock(return_value=mock_model)

    # Patch the library directly so all imports use the mock
    monkeypatch.setattr(
        "sentence_transformers.SentenceTransformer",
        mock_class,
    )
    import infrastructure.cache as cache

    monkeypatch.setattr(cache, "SentenceTransformer", mock_class)

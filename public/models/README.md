# MAESTRO Models Directory

Place your ONNX or WASM model files here.
The Web Worker (`src/integrations/maestro/worker.ts`) will load them from this directory.

Recommended structure:
- `public/models/embedding-model.onnx`
- `public/models/classification-model.onnx`
- `public/models/tokenizer.json`

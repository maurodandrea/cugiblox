# Quantizzazione int8 dinamica per canale del codificatore di immagini esportato da export.py
from onnxruntime.quantization import quantize_dynamic, QuantType
from onnxruntime.quantization.shape_inference import quant_pre_process
quant_pre_process('img_fp32.onnx', 'img_pre.onnx', skip_symbolic_shape=True)
quantize_dynamic('img_pre.onnx', 'img_int8pc.onnx', weight_type=QuantType.QInt8, per_channel=True)

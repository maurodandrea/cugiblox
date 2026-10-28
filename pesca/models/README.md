# Modello di riconoscimento dei pesci

L'app riconosce la specie sul telefono, senza costi e anche offline, con il codificatore di immagini di
[BioCLIP](https://huggingface.co/imageomics/bioclip) (Imageomics Institute, licenza MIT), esportato in ONNX
e quantizzato int8 per canale. Il file è diviso in tre parti (`bioclip-int8.part1..3`) per stare sotto i limiti
consigliati da GitHub; l'app le scarica e le riunisce la prima volta, poi le conserva nella cache del browser.

`fish.json` contiene:
- le 69 specie (nome italiano, nome scientifico, ambienti, misura minima indicativa);
- gli embedding testuali BioCLIP delle descrizioni tassonomiche di ogni specie (int8);
- i prototipi visivi: media degli embedding di circa 20 foto verificate di iNaturalist per specie (int8);
- gli embedding di alcune classi "non pesce" (mano, mare, spiaggia…) per capire se nella foto c'è un pesce;
- i parametri del classificatore (`scale`, peso dei prototipi `w`, penalità per specie fuori ambiente `outside`).

Rigenerazione (Python, `torch`, `open_clip_torch`, `onnx`, `onnxruntime`): `tools/export.py`, poi
`tools/quantize.py`, poi `tools/build.py img_int8pc.onnx both 1.5 50`. Le foto di esempio vengono da
osservazioni iNaturalist di qualità "research" e non sono distribuite: sono incluse solo le loro medie numeriche.

BioCLIP: Stevens et al., *BioCLIP: A Vision Foundation Model for the Tree of Life*, CVPR 2024.

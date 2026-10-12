#!/bin/sh
# Landmark extraction from the dataset (see ml/extract_clean.py). ~25 min on one CPU core.
python3 ml/extract_clean.py ../ASL-Alphabet-Dataset/Data/train --per-class 500 --out ml/data/train.npz &&
python3 ml/extract_clean.py ../ASL-Alphabet-Dataset/Data/test --per-class 200 --seed 1 --out ml/data/test.npz

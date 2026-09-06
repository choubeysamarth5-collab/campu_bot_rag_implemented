import pandas as pd
import pickle

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

df = pd.read_csv("dataset.csv")

vectorizer = TfidfVectorizer()

X = vectorizer.fit_transform(df["text"])

y = df["intent"]

model = LogisticRegression()

model.fit(X, y)

pickle.dump(
    model,
    open("model.pkl", "wb")
)

pickle.dump(
    vectorizer,
    open("vectorizer.pkl", "wb")
)

print("Model trained successfully!")
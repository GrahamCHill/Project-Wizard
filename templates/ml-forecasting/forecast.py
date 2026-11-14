from math import pi, sin, cos
from random import Random
from statistics import mean

from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error


def make_demand(days):
    random = Random(42)
    return [100 + 0.12 * day + 18 * sin(2 * pi * day / 7) + random.gauss(0, 3) for day in range(days)]


def features_for(day, demand):
    phase = 2 * pi * day / 7
    return [day / 365, sin(phase), cos(phase), demand[day - 1], demand[day - 7], mean(demand[day - 7:day])]


def main():
    demand = make_demand(365)
    cutoff = 300
    train_days = range(7, cutoff)
    test_days = range(cutoff, len(demand))
    model = Ridge(alpha=1.0)
    model.fit([features_for(day, demand) for day in train_days], demand[7:cutoff])
    predictions = model.predict([features_for(day, demand) for day in test_days])
    baseline = [demand[day - 7] for day in test_days]
    observed = demand[cutoff:]
    print(f"Weekly baseline MAE {mean_absolute_error(observed, baseline):.2f}")
    print(f"Model MAE {mean_absolute_error(observed, predictions):.2f}")
    forecast = model.predict([features_for(len(demand), demand)])[0]
    print(f"Next day's forecast {forecast:.1f} units")


if __name__ == "__main__":
    main()

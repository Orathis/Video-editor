#!/usr/bin/env python3
"""Clustered means, clustered paired differences, and the design effect.

Briefs written for the same target move are not independent observations. Round
2 reported bare means over 227 briefs, which silently claimed 227 independent
observations when the corpus only carried about 199 worth. That error gets worse
as the corpus grows: more briefs per move means a larger design effect, so a
bigger corpus would otherwise produce narrower intervals that are simply wrong.

Every mean the eval reports goes through here. The cluster key is the target
move taken from the gold set, never the brief id.

Standard library only, no network, same as every other script in this eval.
"""

import math
import statistics

CONFIDENCE = 0.95

# Two sided 95 percent Student t multipliers. Round 3 sweeps hundreds of
# clusters where 1.96 is already correct, but a cell that ran on a handful of
# moves lands in the small df range where 1.96 understates the interval by half,
# and reading the multiplier off a table is shorter and less fragile than
# inverting the t distribution by hand.
_T95 = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
    16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
    21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060,
    26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
}

# Above 30 df the multiplier is very close to linear in 1/df, so these anchors
# plus straight interpolation stay within a thousandth of the true value. The
# last anchor is the normal limit at 1/df = 0.
_T95_TAIL = (
    (1 / 30, 2.042), (1 / 40, 2.021), (1 / 50, 2.009), (1 / 60, 2.000),
    (1 / 80, 1.990), (1 / 100, 1.984), (1 / 120, 1.980), (0.0, 1.960),
)


def t_critical(df):
    """The 95 percent two sided multiplier for df degrees of freedom.

    Infinite below one degree of freedom. A single cluster carries no
    information about its own spread, and an interval that pretends otherwise is
    the exact failure this module exists to prevent.
    """
    if df < 1:
        return math.inf
    if df <= 30:
        return _T95[int(df)]
    inverse = 1.0 / df
    for (high_x, high_t), (low_x, low_t) in zip(_T95_TAIL, _T95_TAIL[1:]):
        if low_x <= inverse <= high_x:
            span = high_x - low_x
            return low_t + (high_t - low_t) * (inverse - low_x) / span
    return _T95_TAIL[-1][1]


def _group(values, clusters):
    """Values regrouped by cluster key, in first seen order.

    Keys with no observations cannot appear, so a caller iterating a full move
    list rather than the observed briefs cannot produce a cluster of size zero.
    """
    groups = {}
    for value, key in zip(values, clusters):
        groups.setdefault(key, []).append(float(value))
    return list(groups.values())


def intra_cluster_correlation(values, clusters):
    """How much of the variance sits between clusters rather than inside them.

    One way ANOVA estimator with the usual unequal size correction, so a
    wave-interrupted corpus with some moves at three briefs and some at two is
    handled without a separate path.

    Returns (icc, design_effect, effective_n). A negative estimate is clamped to
    zero: a negative design effect would report more independent observations
    than there are briefs, which is the opposite of the error this guards.
    """
    groups = _group(values, clusters)
    n = sum(len(group) for group in groups)
    k = len(groups)
    if n == 0:
        return 0.0, 1.0, 0.0
    if k < 2:
        # Every brief on one move. Nothing separates a real signal from the same
        # observation repeated, so the corpus holds one independent observation.
        return 1.0, float(n), 1.0
    within_df = n - k
    if within_df == 0:
        # Every cluster holds one brief, so there is no within-cluster spread to
        # correlate against. The design effect is 1 either way.
        return 0.0, 1.0, float(n)

    means = [statistics.fmean(group) for group in groups]
    grand = statistics.fmean([value for group in groups for value in group])
    between = sum(
        len(group) * (mean - grand) ** 2 for group, mean in zip(groups, means)
    ) / (k - 1)
    within = sum(
        (value - mean) ** 2 for group, mean in zip(groups, means) for value in group
    ) / within_df
    corrected_size = (n - sum(len(group) ** 2 for group in groups) / n) / (k - 1)

    denominator = between + (corrected_size - 1) * within
    icc = (between - within) / denominator if denominator > 0 else 0.0
    icc = min(max(icc, 0.0), 1.0)

    mean_size = n / k
    design_effect = 1.0 + (mean_size - 1.0) * icc
    return icc, design_effect, n / design_effect


def clustered_mean(values, clusters, bounds=(0.0, 1.0)):
    """A mean with a 95 percent interval that treats the cluster as the unit.

    The interval is the cluster robust (sandwich) estimator, which collapses
    exactly onto the ordinary standard error when every cluster holds a single
    observation, so switching to it never widens an interval that was already
    honest. The correlation, design effect and effective n ride alongside as the
    diagnostic that explains why the interval is as wide as it is; they are
    reported, not used, since the sandwich already carries the clustering.

    Every quantity this eval averages is a rate, so the interval is clipped to
    the range the underlying observations could have taken. Reporting a refusal
    rate of "-0.0110 to 0.0110" would spend the reader's attention on a bound
    the measurement forbids. Paired differences pass their own wider range, and
    an unbounded interval is left alone because a single cluster genuinely
    bounds nothing.
    """
    values = [float(value) for value in values]
    clusters = list(clusters)
    n = len(values)
    if n == 0:
        return {
            "mean": 0.0, "lo": 0.0, "hi": 0.0, "se": 0.0,
            "n": 0, "clusters": 0,
            "icc": 0.0, "design_effect": 1.0, "n_eff": 0.0,
        }

    mean = statistics.fmean(values)
    groups = _group(values, clusters)
    k = len(groups)
    icc, design_effect, n_eff = intra_cluster_correlation(values, clusters)

    if k < 2:
        standard_error = math.inf
    else:
        residual = sum((sum(group) - len(group) * mean) ** 2 for group in groups)
        standard_error = math.sqrt(k / (k - 1) * residual) / n

    half_width = t_critical(k - 1) * standard_error
    if k >= 2 and standard_error == 0.0:
        # Every cluster landed on the same value, so the sandwich reports zero
        # width. That is arithmetic, not evidence: 0 refusals in 273 runs does
        # not establish that the refusal rate is exactly 0.0000, only that it is
        # small. The rule of three is the standard bound for this case, and the
        # widest it can be wrong by is the same 3/k it hands back, so a report
        # that shows it can never claim more certainty than the data holds.
        half_width = 3.0 / k

    lo, hi = mean - half_width, mean + half_width
    if bounds is not None and math.isfinite(half_width):
        lo, hi = max(lo, bounds[0]), min(hi, bounds[1])
    return {
        "mean": round(mean, 4),
        "lo": round(lo, 4),
        "hi": round(hi, 4),
        "se": round(standard_error, 4),
        "n": n,
        "clusters": k,
        "icc": round(icc, 4),
        "design_effect": round(design_effect, 4),
        "n_eff": round(n_eff, 1),
    }


def clustered_difference(values, baseline, clusters):
    """Paired difference between two arms, with a clustered interval.

    Differencing per brief first and clustering the differences is what holds
    brief difficulty fixed. Subtracting two column means does not, and the
    pre-registered decision rule is written against the paired quantity.

    The length check is the point of the wrapper: zip would silently truncate a
    mismatched pairing and report a difference over a subset of the corpus.
    """
    if not len(values) == len(baseline) == len(clusters):
        raise ValueError(
            "paired difference needs one baseline value and one cluster per value"
        )
    return clustered_mean(
        [a - b for a, b in zip(values, baseline)], clusters, bounds=(-1.0, 1.0)
    )


def format_interval(interval):
    """One cell of a report table. Infinite bounds read as such rather than as a
    number, because a single cluster genuinely bounds nothing."""
    lo, hi = interval["lo"], interval["hi"]
    if not math.isfinite(lo) or not math.isfinite(hi):
        return "unbounded"
    return f"{lo:.4f} to {hi:.4f}"

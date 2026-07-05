---
name: shaxda-rules
description: Authoritative Shaxda rules and rules-engine invariants. Use whenever implementing, changing, or testing the rules engine, move generation/validation, replay, or online game-state sync.
---

# Shaxda Rules Skill

## Source of Truth

Read `docs/shaxda_game.md` before writing engine code.

This skill is a condensed checklist. `docs/shaxda_game.md` is authoritative.

## Board

Shaxda has 24 points:

```txt
Outer:  O1 O2 O3 O4 O5 O6 O7 O8
Middle: M1 M2 M3 M4 M5 M6 M7 M8
Inner:  I1 I2 I3 I4 I5 I6 I7 I8
```

Three connected squares:

- each ring connects in order and wraps around;
- spokes connect only even edge-midpoints:
  - O2-M2-I2
  - O4-M4-I4
  - O6-M6-I6
  - O8-M8-I8
- no diagonal movement;
- no corner-to-corner spokes.

Expected degrees:

- corners: 2;
- outer/inner edge-midpoints: 3;
- middle edge-midpoints: 4.

## Valid Jare Lines

There are 16 jare lines:

- 4 outer sides;
- 4 middle sides;
- 4 inner sides;
- 4 spokes.

No diagonals.

## Phases

1. Placement
2. Initial removal
3. Movement
4. Game over

## Placement Rules

- Players alternate placing pieces until all 24 points are full.
- Each player places 12 pieces.
- Jares can form during placement.
- No captures happen during placement.
- Track the first jare formed during placement.
- The first player to make a jare during placement gets first advantage.
- If no jare forms during placement, the non-starting player gets first advantage.

## Initial Removal Rules

- After all pieces are placed, each player removes one opponent piece.
- The first-advantage player removes first.
- Then the other player removes one opponent piece.
- Any opponent piece may be removed.
- After this phase, each player has 11 pieces and the board has 2 empty points.
- The first-advantage player moves first in movement phase.

## Movement Rules

A legal move:

- slides one own piece;
- to an adjacent empty point;
- along a connected board line.

Illegal:

- jumping;
- diagonal movement;
- moving through a piece;
- moving onto an occupied point;
- moving a non-owned piece.

## Jare and Capture

- A jare is three own pieces in a valid straight connected line.
- A newly formed movement-phase jare allows one capture.
- Capture any one opponent piece.
- Only one capture per move, even if the move completes two jares.

## Repeated Jare

- A standing jare cannot score repeatedly.
- A jare must be broken and later re-formed to capture again.
- Track per-jare scored state.
- Clear the scored state when that jare breaks.

## Blocked Player

- A player with zero legal moves does not lose automatically.
- The opponent must make a space-making move.
- The space-making move:
  - must not form a jare;
  - must free at least one legal move for the blocked player;
  - does not allow capture.
- If still blocked, space-making continues.
- Blocking alone never wins.

## Irmaan

- Irmaan is a repeated/protected jare the opponent cannot block.
- In V1 it is hint-only if implemented.
- It must not change move legality.

## Win Conditions

A player wins when:

- opponent has fewer than 3 pieces;
- all opponent pieces are captured;
- opponent resigns.

Blocking alone is not a win.

## Required Test Coverage

- all point labels;
- adjacency for degree 2/3/4 points;
- all 16 jare lines;
- placement legality;
- first advantage:
  - starter forms first;
  - opponent forms first;
  - no jare → non-starter gets advantage;
- initial removal order and counts;
- legal move generation;
- illegal move rejection;
- jare on movement;
- two jares formed still gives one capture;
- repeated jare break/reform behavior;
- capture flow;
- blocked-player detection;
- space-making rule;
- win conditions;
- resignation;
- serialization/deserialization;
- compact replay;
- one scripted full game.

# @origin-one/schema

This package does one thing: define the shared data types for all three apps.

## Rules
- All changes require a dedicated PR — never change schema in a feature branch
- All three apps must compile after any schema change before it merges
- No business logic here — types and validators only (Zod)

## Core types
Project, Scene, Shot, Entity (Character, Location, Prop),
Document, User, Team, Role

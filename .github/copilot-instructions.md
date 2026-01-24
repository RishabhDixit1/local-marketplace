# Copilot Instructions for AI Coding Agents

**Last Updated:** January 24, 2026

## Project Overview

This repository is in the early stages of development. The following sections establish conventions and patterns for AI agents to follow as the codebase grows.

---

## Architecture & Components

_This section should document the high-level architecture once the project structure is defined._

**Key areas to document when adding code:**
- Major components and their responsibilities
- Service boundaries and communication patterns
- Data flow between modules
- Technology stack and framework choices

---

## Development Workflow

### Getting Started
1. **Clone and Setup:** `git clone <repo> && cd <project-dir>`
2. **Installation:** [Document install commands here - e.g., `npm install`, `poetry install`]
3. **Local Development:** [Document how to run the project locally]

### Building & Testing
- **Build:** [Document build command]
- **Tests:** [Document test command and test structure]
- **Linting:** [Document linting/formatting tools]
- **Running Locally:** [Document local server/dev command]

---

## Code Conventions & Patterns

### File Organization
_Document the directory structure and file naming conventions when established:_
- Example: `src/components/` for React components, `src/utils/` for utilities
- File naming: PascalCase for components, camelCase for utilities

### Code Style
- **Language-specific standards:** [e.g., ESLint config, Black formatting]
- **Import organization:** [e.g., group standard library, third-party, local]
- **Naming conventions:** [Variables, functions, constants]

### Error Handling & Logging
_Document patterns for error handling and observability:_
- How errors are caught and propagated
- Logging strategy (structured logs, log levels)
- Example patterns from the codebase

---

## Integration Points & Dependencies

### External Services
_Document integrations with external APIs, databases, or services:_
- Authentication/authorization mechanisms
- Required environment variables
- Rate limiting or quota considerations

### Key Dependencies
_List critical libraries and their usage:_
- Framework/runtime: [e.g., Node.js, Python, Go]
- Web framework: [e.g., Express, FastAPI, Gin]
- Database/ORM: [e.g., PostgreSQL, SQLAlchemy]
- Testing: [e.g., Jest, pytest, Go test]

---

## Common Tasks

### Adding a New Feature
_Steps AI agents should follow:_
1. Identify affected components
2. Update data model if needed
3. Implement feature logic
4. Add tests
5. Update relevant documentation

### Debugging Issues
- Key files to check: [Document where to look for common issues]
- Relevant logs: [Where logs are written]
- Debug mode: [How to enable debug logging/mode]

### Running Tests
```bash
# Example - update to match your setup
npm test
```

---

## Critical Files

- `.github/copilot-instructions.md` - This file; update when conventions change
- `README.md` - High-level project documentation
- [Document key configuration files: `package.json`, `setup.py`, `go.mod`, etc.]

---

## Notes for AI Agents

- **When in doubt about patterns:** Check recent commits or open PRs for examples
- **Before making large changes:** Verify alignment with existing code structure
- **Documentation is critical:** Update this file when introducing new patterns
- **Test thoroughly:** Run the full test suite before suggesting changes

---

## How to Update This File

When adding new features or changing architecture:
1. Document the pattern with specific file examples
2. Explain the "why" behind structural decisions
3. Include any gotchas or non-obvious requirements
4. Update the "Last Updated" date at the top

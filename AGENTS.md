# AGENTS.md - Development Guidelines for REKT Backend

## Build/Test Commands

### Trading Backend (Current - Port 3004)

- `npm start` - Start production server on port 3004
- `npm run dev` - Start development server with auto-restart (nodemon)
- `node tests/run-tests.js` - Run full test suite (42 tests)
- `node tests/run-tests.js --health` - Server health check only
- `node tests/run-tests.js --utils-only` - Run utility tests only
- `node tests/run-tests.js --api-only` - Run API endpoint tests only
- `node tests/run-tests.js --drift-only` - Run Drift SDK integration tests only

### User Management Backend (New - Render/Port 3005)

- `cd render-backend && npm start` - Start user management server
- `cd render-backend && npm run dev` - Development with auto-restart
- `cd render-backend && npm test` - Run user management tests

## Code Style Guidelines

- **Imports**: Use CommonJS `require()` syntax, group by: Node.js built-ins, external packages, local modules
- **Formatting**: 2-space indentation, semicolons required, double quotes for strings
- **Variables**: Use `const` by default, `let` when reassignment needed, descriptive camelCase names
- **Functions**: Async/await preferred over promises, JSDoc comments for complex functions
- **Error Handling**: Always use try-catch blocks, structured error responses with debugging info
- **Logging**: Use descriptive console.log with emojis for visual categorization (📊 💡 ⚠️ ✅)
- **Constants**: Centralized in `src/constants.js`, ALL_CAPS naming convention
- **Comments**: Minimal inline comments, focus on WHY not WHAT, use JSDoc for function documentation

## User Onboarding System Architecture

### Two-Backend System

- **Trading Backend** (src/server.js, port 3004) - Drift SDK, WebSocket, trading operations
- **User Backend** (render-backend/, Render deployment) - Auth, profiles, avatar uploads
- **Database**: Supabase (amgeuvathssbhopfvubw) with existing `profiles` table schema
- **Frontend Flow**: auth.html → dashboard.html (renamed from index.html)

### Key Implementation Details

- **Auth Method**: Simple email lookup (no passwords, magic links upgrade path ready)
- **Validation**: Real-time username availability, email uniqueness, avatar <5MB
- **Environment Toggle**: Development (localhost:3005) vs Production (Render URL)
- **Session**: localStorage (JWT upgrade path ready)

### User Management API Endpoints

- `POST /api/auth/signin` - Email lookup authentication
- `POST /api/auth/create-account` - Username + email + avatar account creation
- `POST /api/auth/check-username` - Real-time username availability
- `POST /api/auth/check-email` - Email uniqueness validation
- `POST /api/users/upload-avatar` - Avatar upload to Supabase Storage

## Testing Requirements

### Trading Backend Tests

- Always run full test suite after code changes: `node tests/run-tests.js`
- Verify 80%+ test pass rate before committing changes
- Test high-leverage trades (>20x) specifically after Drift SDK updates
- Monitor for InsufficientCollateral errors and buffer offset issues

### User Management Tests

- Test username/email validation endpoints
- Verify avatar upload/resize functionality
- Test auth flow integration with trading dashboard
- Validate environment toggle between local/production backends

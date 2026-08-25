Objective:
Convert Void Striker so players must log in or sign up before they can reach the menu or play the game. No guest play path should lead to gameplay.

Target audience:
Players of an existing AngularJS canvas shooter. Keep the UI fast and game-like, not a marketing page.

Aesthetic direction:
Use the existing neon arcade style already defined in src/css/style.css. The auth screen should feel like the current panel/menu UI and reuse existing assets such as the selected pilot image.

Content structure:
- App startup checks GameDb.getCurrentUser().
- If an account session exists, load menu as today.
- If no account session exists, show a new auth screen before the menu.
- Auth screen has Sign In and Sign Up modes.
- Sign In asks for email and password.
- Sign Up asks for pilot name, email, and password.
- Successful auth applies user progress and goes to menu.
- Settings can keep account controls, but logout must return to the auth screen.
- The Play button must not start a run unless vm.isSignedIn() is true.

Typography and color:
Use the existing Orbitron/Rubik fonts and CSS variables. Keep type compact so it fits mobile panels.

Output path:
C:\Users\Mark Gil\OneDrive\Documents\3rd year_Projects\bondstriker

Relevant existing files:
- index.html
- src/js/app.js
- src/js/db.js
- src/css/style.css

Constraints:
- Use AngularJS patterns already in the project.
- Keep edits scoped.
- Do not add a landing page.
- Do not remove database/device leaderboard support unless it is directly necessary.
- Do not rely on external image services.

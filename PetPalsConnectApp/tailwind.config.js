/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}", // Include your main App file.
    "./src/**/*.{js,jsx,ts,tsx}", // Assuming all components are in 'src' directory.
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

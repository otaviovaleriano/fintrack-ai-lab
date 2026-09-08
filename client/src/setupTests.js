// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// react-router-dom's internals use TextEncoder, which the jsdom version
// bundled with react-scripts' Jest 27 does not expose as a global.
import { TextEncoder } from 'util';
global.TextEncoder = TextEncoder;

/**
 * XS Card Header Script
 * This script has been disabled to prevent any logos or headers from being displayed.
 */

function initLogoHeader() {
  // This function is now a no-op to avoid adding any elements to the page
  console.log('Logo header functionality has been disabled');
}

// Auto-initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initLogoHeader); 

/* ORIGINAL CODE - COMMENTED OUT
function initLogoHeader() {
  // Create the logo header container
  const headerDiv = document.createElement('div');
  headerDiv.className = 'xs-logo-header';
  
  // Try several possible paths to find the correct one
  const possiblePaths = [
    '../../assets/images/xslogo.png',
    '../../../assets/images/xslogo.png',
    '/assets/images/xslogo.png',
    './assets/images/xslogo.png',
    '../assets/images/xslogo.png'
  ];
  
  // Create the logo image
  const logoImg = document.createElement('img');
  logoImg.src = '../../assets/images/xslogo.png'; // Default path
  logoImg.alt = 'XS Card Logo';
  logoImg.className = 'xs-logo';
  
  // Test each path and use the first one that works
  for (const path of possiblePaths) {
    const testImg = new Image();
    testImg.onload = function() {
      console.log(`XS Logo found at: ${path}`);
      logoImg.src = path; // Update the source if this path works
    };
    testImg.src = path;
  }
  
  // Append elements
  headerDiv.appendChild(logoImg);
  
  // Add header to the beginning of the body
  const body = document.body;
  body.insertBefore(headerDiv, body.firstChild);
  
  // Add the CSS styles
  const style = document.createElement('style');
  style.textContent = `
    .xs-logo-header {
      background-color: #1B2B5B;
      padding: 15px 0;
      text-align: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      position: relative;
      z-index: 10;
    }
    
    .xs-logo {
      height: 40px;
      width: auto;
    }
  `;
  
  document.head.appendChild(style);
}
*/ 
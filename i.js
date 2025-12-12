// Function to add two numbers
function addNumbers(num1, num2) {
  return num1 + num2;
}

// Function to subtract two numbers
function subtractNumbers(num1, num2) {
  return num1 - num2;
}

// Main function to call the addition and subtraction functions
function main() {
  const number1 = 10; // First number
  const number2 = 5;  // Second number

  // Call the addition function
  const sum = addNumbers(number1, number2);

  // Call the subtraction function
  const difference = subtractNumbers(number1, number2);

  // Output the results
  console.log(`The numbers are: ${number1} and ${number2}`);
  console.log(`Addition result: ${sum}`);
  console.log(`Subtraction result: ${difference}`);
}

// Execute the main function
main();
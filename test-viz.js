// Test file for CodeViz visualization

// Test function 1: Simple linear flow
function calculateSum(numbers) {
    let sum = 0;
    for (let i = 0; i < numbers.length; i++) {
        sum += numbers[i];
    }
    return sum;
}

// Test function 2: Conditional logic
function checkNumber(n) {
    if (n > 0) {
        return "positive";
    } else if (n < 0) {
        return "negative";
    } else {
        return "zero";
    }
}

// Test function 3: Loop with condition
function findElement(arr, target) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === target) {
            return i;
        }
    }
    return -1;
}

// Test function 4: Complex logic
function processData(data) {
    let result = [];
    for (let item of data) {
        if (item > 10) {
            if (item % 2 === 0) {
                result.push(item * 2);
            } else {
                result.push(item * 3);
            }
        }
    }
    return result;
}

// Test function 5: Arrow function
const multiply = (a, b) => {
    return a * b;
};

console.log("Test file loaded. Use Visualize command on any of these functions.");

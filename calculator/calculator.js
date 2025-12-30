document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('abv-form');
    const resultDiv = document.getElementById('result');
    const finalAbvSpan = document.getElementById('final-abv');
    const ingredientsContainer = document.getElementById('ingredients-container');
    const addIngredientBtn = document.getElementById('add-ingredient-btn');

    let ingredientCount = 1; // Start with 1 ingredient

    // --- Function to add a new ingredient row ---
    const addIngredientRow = () => {
        ingredientCount++;
        const newGroup = document.createElement('div');
        newGroup.classList.add('ingredient-group');
        // Updated innerHTML for new layout
        newGroup.innerHTML = `
            <hr>
            <div class="inputs-wrapper">
                <div class="form-group">
                    <label>成分 ${ingredientCount} 体积 (ml):</label>
                    <input type="number" class="ingredient-volume" min="0" step="any" required>
                </div>
                <div class="form-group">
                    <label>成分 ${ingredientCount} 酒精度 (%):</label>
                    <input type="number" class="ingredient-abv" min="0" max="100" step="any" value="0" required>
                </div>
            </div>
            <button type="button" class="remove-ingredient-btn">移除该成分</button>
        `;
        ingredientsContainer.appendChild(newGroup);

        // Add event listener to the new remove button
        newGroup.querySelector('.remove-ingredient-btn').addEventListener('click', function() {
            removeIngredientRow(this.closest('.ingredient-group'));
        });
    };

    // --- Function to remove an ingredient row ---
    const removeIngredientRow = (groupElement) => {
        // Don't remove the very first ingredient group
        if (ingredientsContainer.children.length > 1) {
            groupElement.remove();
            // Renumber remaining ingredients (optional but good UX)
            renumberIngredients();
        } else {
            alert('至少需要一个成分。');
        }
    };

    // --- Function to renumber ingredient labels ---
    const renumberIngredients = () => {
        const groups = ingredientsContainer.querySelectorAll('.ingredient-group');
        ingredientCount = groups.length; // Reset count based on current number of groups
        groups.forEach((group, index) => {
            const number = index + 1;
            const labels = group.querySelectorAll('label');
            if (labels.length >= 2) {
                labels[0].textContent = `成分 ${number} 体积 (ml):`;
                labels[1].textContent = `成分 ${number} 酒精度 (%):`;
            }
        });
    };


    // --- Event Listener for Add Ingredient Button ---
    if (addIngredientBtn) {
        addIngredientBtn.addEventListener('click', addIngredientRow);
    }

    // --- Event Listener for Form Submission ---
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            resultDiv.style.display = 'none'; // Hide previous result

            let totalVolume = 0;
            let totalAlcoholVolume = 0;
            let calculationValid = true;

            const ingredientGroups = ingredientsContainer.querySelectorAll('.ingredient-group');

            ingredientGroups.forEach(group => {
                const volumeInput = group.querySelector('.ingredient-volume');
                const abvInput = group.querySelector('.ingredient-abv');

                // Basic check if inputs exist (should always be true here)
                if (!volumeInput || !abvInput) {
                    calculationValid = false;
                    return; // Skip this group
                }

                const volume = parseFloat(volumeInput.value);
                const abv = parseFloat(abvInput.value);

                // Validate inputs
                if (isNaN(volume) || volume < 0 || isNaN(abv) || abv < 0 || abv > 100) {
                    // Mark as invalid but continue processing other rows to potentially find more errors
                    // Or you could stop immediately: calculationValid = false; return;
                    volumeInput.style.borderColor = 'red'; // Highlight invalid input
                    abvInput.style.borderColor = 'red';
                    calculationValid = false;
                } else {
                    volumeInput.style.borderColor = ''; // Reset border color
                    abvInput.style.borderColor = '';
                    totalVolume += volume;
                    totalAlcoholVolume += volume * (abv / 100);
                }
            });

            if (!calculationValid) {
                 alert('请检查所有成分的体积和酒精度是否有效 (体积>=0, 酒精度 0-100)。');
                 return;
            }

            if (totalVolume <= 0) {
                alert('总 体积必须大于 0。');
                return;
            }

            const finalAbv = (totalAlcoholVolume / totalVolume) * 100;

            finalAbvSpan.textContent = finalAbv.toFixed(2); // Display with 2 decimal places
            resultDiv.style.display = 'block'; // Show result section
        });
    }

    // Initial setup: Add remove button listener if needed (only if starting with >1 row)
    // Since we start with 1 row, no initial remove button is needed.
});

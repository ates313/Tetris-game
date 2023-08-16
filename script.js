
(function () {
    // render board constants
    const boardWidth = 10;
    const boardHeight = boardWidth * 2;
    const boardElemId = "game-board";
    const gameStepIntervalMs = 300;
    const clearStepIntervalMs = gameStepIntervalMs / 2;
    const actions = Object.freeze({
        left: "ArrowLeft",
        right: "ArrowRight",
        down: "ArrowDown",
        rotate: "ArrowUp"
    });
    /** @type {string[]} */ const userActions = [];

    // game actions
    document.addEventListener("keydown", (e) => {
        if (Object.values(actions).map(String).includes(e.key)) {
            e.preventDefault();
            userActions.push(e.key);
            step(true);
        }
    });

    /**
     * Render current game board including floating tiles
     * @param {readonly (readonly number[])[]} b
     * @param {{ value: readonly (readonly [number, number])[]; x: number; y: number; } | null} f
     * @param {readonly (readonly number[])[]} bh
     */
    function renderBoard(b, f, bh) {
        const gameBoard = cloneBoard(b);
        f?.value.forEach(([x, y]) => {
            gameBoard[x + f.x][y + f.y] = 1;
        });
        drawBoard(boardElemId, gameBoard, bh);
    }

    /**
     * Apply actions to game board
     * @param {readonly (readonly number[])[]} b
     * @param {{ value: readonly (readonly [number, number])[]; x: number; y: number; } | null} f
     * @returns {[readonly (readonly number[])[], {value: readonly (readonly [number, number])[], x: number, y: number} | null]}
     */
    function applyActions(b, f) {
        if (isGameOver(b)) return [b, f];
        const board = cloneBoard(b);
        let float = f && { ...f };
        const boardWidth = board.length;
        const boardHeight = board[0].length;
        if (float) {
            const floatWidth = getTileGroupWidth(float.value);
            userActions.splice(0).forEach((action) => {
                if (!float) return;
                if (action === actions.left) {
                    float.x = Math.max(float.x - 1, 0);
                } else if (action === actions.right) {
                    float.x = Math.min(float.x + 1, boardWidth - floatWidth - 1);
                } else if (action === actions.down) {
                    const nextBoard = dropFloatingTiles(board, float);
                    boardHighlight = boardDiff(board, nextBoard);
                    copyBoardAIntoB(nextBoard, board);
                    float = null;
                } else if (action === actions.rotate) {
                    float.value = rotateTileGroup(float.value);
                    const rotatedFloatWidth = getTileGroupWidth(float.value);
                    const rotatedFloatHeight = getTileGroupHeight(float.value);
                    float.x = Math.min(float.x, boardWidth - rotatedFloatWidth - 1);
                    float.y = Math.min(float.y, boardHeight - rotatedFloatHeight - 1);
                }
            });
        }
        return [board, float];
    }

    // Create new updatable game board
    let board = newBoard(boardWidth, boardHeight);
    let boardHighlight = cloneBoard(board);
    let float = null;

    // game step function
    let stepTimeout = null;
    const step = async (/** @type {boolean | undefined} */ userActionsOnly) => {
        clearTimeout(stepTimeout);
        if (isGameOver(board)) return;

        if (!float) {
            float = newFloat(boardWidth);
        }
        [board, float] = applyActions(board, float);
        renderBoard(board, float, boardHighlight);

        if (!userActionsOnly) {
            const score = getBottomContiguous(board);
            for (let i = 0; i < score; i++) {
                board = removeBottomRow(board);
                await delay(clearStepIntervalMs);
                renderBoard(board, float, boardHighlight);
            }
            const [nextBoard, nextFloat] = iterBoard(board, float);
            boardHighlight = boardDiff(board, nextBoard);
            board = nextBoard;
            float = nextFloat;
        }

        stepTimeout = setTimeout(step, gameStepIntervalMs);
    };

    step();
})();

/**
 * Create new game board
 * @param {number} width
 * @param {number} height
 * @param {() => number} fillCell
 * @returns {readonly (readonly number[])[]}
 */
function newBoard(width, height, fillCell = () => 0) {
    return Object.freeze(
        new Array(width)
            .fill(undefined)
            .map(() => Object.freeze(new Array(height).fill(undefined).map(fillCell)))
    );
}

/**
 * Create new floating group at default position
 * @param {number} boardWidth
 * @param {number} length
 * @returns {{ value: readonly (readonly [number, number])[]; x: number; y: number; }}
 */
function newFloat(boardWidth, length = 4) {
    const value = randomGroup(length);
    const floatWidth = getTileGroupWidth(value);
    return {
        value,
        x: Math.floor((boardWidth - floatWidth) / 2),
        y: 0
    };
}

/**
 * Get width of tile group on x axis
 * @param {readonly (readonly [number, number])[]} value
 * @returns {number}
 */
function getTileGroupWidth(value) {
    const xs = value.map((v) => v[0]);
    return Math.max(...xs) - Math.min(...xs);
}

/**
 * Get height of tile group on y axis
 * @param {readonly (readonly [number, number])[]} value
 * @returns {number}
 */
function getTileGroupHeight(value) {
    const ys = value.map((v) => v[1]);
    return Math.max(...ys) - Math.min(...ys);
}

/**
 * Draw on the screen the contents of the game board
 * @param {string} elemId
 * @param {number[][]} gameBoard
 * @param {readonly (readonly number[])[]} boardHighlight
 */
function drawBoard(elemId, gameBoard, boardHighlight) {
    const score = getBottomContiguous(gameBoard);
    const bottomIndex = gameBoard[0].length - score;

    /**
     * Create cell for board render
     * @param {number} value
     * @param {number} x
     * @param {number} y
     * @returns {HTMLDivElement}
     */
    function createCell(value, x, y) {
        const cell = document.createElement("div");
        cell.style.width = "20px";
        cell.style.height = cell.style.width;
        cell.style.border = `1px solid rgba(0,0,0,.2)`;
        cell.style.margin = "none";
        cell.style.backgroundColor = value
            ? `rgba(${y >= bottomIndex
                ? "196,0,0"
                : boardHighlight[x][y]
                    ? "0,64,196"
                    : "32,32,32"
            },1)`
            : "white";
        return cell;
    }

    /**
     * Create board column to be rendered
     * @param {number[]} cells
     * @param {number} x
     */
    function createColumn(cells, x) {
        const rowWrapper = document.createElement("div");
        rowWrapper.style.display = "flex-row";
        rowWrapper.style.alignItems = "center";
        rowWrapper.style.justifyContent = "center";
        cells.forEach((value, y) =>
            rowWrapper.appendChild(createCell(value, x, y))
        );
        return rowWrapper;
    }

    // prepare board elem
    const boardWrapper = document.getElementById(elemId);
    if (!boardWrapper) return;
    boardWrapper.style.padding = "12px";
    boardWrapper.style.display = "flex";
    boardWrapper.style.alignItems = "center";
    boardWrapper.style.justifyContent = "center";
    boardWrapper.innerHTML = ""; // reset before drawing elements
    gameBoard.forEach((row, i) => boardWrapper.appendChild(createColumn(row, i)));

    // highlight bottom rows that are contiguous
}

/**
 * Iterate board into next state i.e. moving all cells that can be moved downwards
 * @param {readonly (readonly number[])[]} board
 * @param {{value: readonly (readonly [number, number])[], x: number, y: number} | null} float
 * @returns {[readonly (readonly number[])[], {value: readonly (readonly [number, number])[], x: number, y: number} | null]}
 */
function iterBoard(board, float) {
    /**
     * Iterate column cells
     * @param {readonly number[]} cells
     * @returns {number[]}
     */
    function iterColumn(cells) {
        const lastEmptySpace = cells.lastIndexOf(0);
        if (lastEmptySpace < 0) return [...cells];
        return [0, ...cells.filter((_, i) => i != lastEmptySpace)];
    }

    const nextBoard = board.map(iterColumn);
    const nextFloat = float && { ...float, y: float.y + 1 };

    const shouldDrop = nextFloat?.value.some(([x, y]) => {
        const column = board[x + nextFloat.x];
        const nextY = y + nextFloat.y;
        return column[nextY] || nextY == column.length;
    });

    if (shouldDrop) {
        return [dropFloatingTiles(nextBoard, float), null];
    }

    return [nextBoard, nextFloat];
}

/**
 * Compare two boards and return cell difference
 * @param {readonly (readonly number[])[]} boardA
 * @param {readonly (readonly number[])[]} boardB
 * @returns {number[][]}
 */
function boardDiff(boardA, boardB) {
    const diff = cloneBoard(newBoard(boardA.length, boardA[0].length));
    boardA.forEach((column, x) => {
        column.forEach((cellValue, y) => {
            diff[x][y] = Number(cellValue != boardB[x][y]);
        });
    });
    return diff;
}

/**
 * @param {readonly (readonly number[])[]} board
 * @param {{value: readonly (readonly [number, number])[], x: number, y: number} | null} float
 * @returns {number[][]}
 */
function dropFloatingTiles(board, float) {
    const nextBoard = cloneBoard(board);
    const lastIndexes = {};
    float?.value.forEach(([x, y]) => {
        const cells = nextBoard[x + float.x];
        const dropIndex = lastIndexes[x] || cells.lastIndexOf(0);
        lastIndexes[x] -= 1;
        cells[dropIndex] = 1;
    });
    return nextBoard;
}

/**
 * Copy board A into mutable board B
 * @param {readonly (readonly number[])[]} boardA
 * @param {number[][]} boardB
 */
function copyBoardAIntoB(boardA, boardB) {
    boardA.forEach((column, i) =>
        column.forEach((v, j) => {
            boardB[i][j] = v;
        })
    );
}

/**
 * Create duplicate board for mutation
 * @param {readonly (readonly number[])[]} board
 * @returns {number[][]}
 */
function cloneBoard(board) {
    return JSON.parse(JSON.stringify(board));
}

/**
 * Get bottom rows that are contiguous i.e. no empty spaces below or between
 * @param {readonly (readonly number[])[]} board
 * @returns {number}
 */
function getBottomContiguous(board) {
    const width = board.length;
    const height = board[0].length;
    let count = 0;
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (!board[j][height - i - 1]) {
                return i;
            }
        }
        count = i + 1;
    }
    return count;
}

/**
 * Check if game board is in over state
 * @param {readonly (readonly number[])[]} board
 * @returns {boolean}
 */
function isGameOver(board) {
    return board.some((cells) => cells.lastIndexOf(0) < 0);
}

/**
 * Pop bottom row from board
 * @param {readonly (readonly number[])[]} board
 * @param {number} count
 * @returns {readonly (readonly number[])[]}
 */
function removeBottomRow(board, count = 1) {
    /**
     * Remove last cell from column
     * @param {readonly number[]} cells
     * @returns {readonly number[]}
     */
    function removeLastCell(cells) {
        return Object.freeze([
            ...new Array(count).fill(0),
            ...cells.slice(0, -count)
        ]);
    }

    return board.map(removeLastCell);
}

/**
 * Wait for delay milliseconds before resolving promise
 * @param {number} delayMs
 * @returns {Promise<undefined>}
 */
async function delay(delayMs) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Create a tile group that can be placed
 * @param {number} n number of tiles in group
 * @returns {readonly (readonly [number, number])[]} new tile group
 */
function randomGroup(n = 4) {
    /**
     * Turn tile object into string
     * @param {readonly number[]} t
     * @returns {string}
     */
    function dehydrateTile(t) {
        return t.join(",");
    }
    /**
     * Turn string tile into js number object
     * @param {string} t
     * @returns {readonly [number, number]}
     */
    function hydrateTile(t) {
        const [x, y] = t.split(",").map(Number);
        return Object.freeze([x, y]);
    }

    let lastTile = "0,0";
    const group = new Set([lastTile]);
    while (group.size < n) {
        const lastTileHydrated = hydrateTile(lastTile);
        const leftOrRight = randomInt(-1, 1);
        const nextX = lastTileHydrated[0] + leftOrRight;
        const nextY =
            lastTileHydrated[1] + (Math.abs(leftOrRight) ? 0 : randomInt(-1, 1));
        lastTile = dehydrateTile([nextX, nextY]);
        group.add(lastTile);
    }

    return Object.freeze(
        normaliseTileGroup(Array.from(group).sort().map(hydrateTile))
    );
}

/**
 * @param {readonly (readonly [number, number])[]} tileGroup
 * @return {readonly (readonly [number, number])[]}
 */
function rotateTileGroup(tileGroup) {
    return normaliseTileGroup(tileGroup.map(([x, y]) => [-y, x]));
}

/**
 * Reset to be based on 0,0 coordinates
 * @param {readonly (readonly [number, number])[]} tileGroup
 * @returns {readonly (readonly [number, number])[]}
 */
function normaliseTileGroup(tileGroup) {
    const minX = Math.min(...tileGroup.map((v) => v[0]));
    const minY = Math.min(...tileGroup.map((v) => v[1]));

    return tileGroup.map((tile) => {
        return [tile[0] - minX, tile[1] - minY];
    });
}

/**
 * Random number between min and max
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
    return Math.round(Math.random() * (max - min)) + min;
}



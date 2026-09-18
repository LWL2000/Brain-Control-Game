(function () {
    "use strict";

    const W = 900;
    const H = 620;
    const TAU = Math.PI * 2;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function randInt(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    }

    function sample(list) {
        return list[randInt(0, list.length - 1)];
    }

    function fillRoundRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
        ctx.fill();
    }

    function drawBackground(ctx, top, bottom) {
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, top);
        gradient.addColorStop(1, bottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);
    }

    function drawText(ctx, text, x, y, size, color, align) {
        ctx.fillStyle = color || "#eef4fb";
        ctx.font = `800 ${size}px Microsoft YaHei, Segoe UI, Arial, sans-serif`;
        ctx.textAlign = align || "center";
        ctx.fillText(text, x, y);
    }

    function drawSmallText(ctx, text, x, y, color, align) {
        ctx.fillStyle = color || "rgba(238,244,251,0.78)";
        ctx.font = "600 17px Microsoft YaHei, Segoe UI, Arial, sans-serif";
        ctx.textAlign = align || "center";
        ctx.fillText(text, x, y);
    }

    function drawFeedback(ctx, message, color) {
        if (!message) {
            return;
        }
        ctx.fillStyle = "rgba(6, 11, 17, 0.72)";
        fillRoundRect(ctx, 235, 28, 430, 50, 8);
        drawText(ctx, message, W / 2, 61, 20, color || "#f5bd4f");
    }

    function makeLaneX(lane) {
        return [260, 450, 640][lane];
    }

    function makeFeedbackState() {
        return { text: "", timer: 0, color: "#f5bd4f" };
    }

    function setFeedback(state, text, color) {
        state.text = text;
        state.color = color || "#f5bd4f";
        state.timer = 1.4;
    }

    function updateFeedback(state, dt) {
        state.timer = Math.max(0, state.timer - dt);
        if (state.timer <= 0) {
            state.text = "";
        }
    }

    const games = {
        space_shooter: {
            title: "太空打陨石",
            subtitle: "SSVEP 回合制射击：选好航道后发射，敌机只在指令后推进。",
            commands: { left: "左移一格", right: "右移一格", action: "发射当前航道" },
            intro: {
                theme: "start-space",
                title: "太空打陨石 · SSVEP巡航模式",
                body: "敌机不会实时下落。每完成一次 SSVEP 识别，飞船才执行一步；发射只命中当前航道。",
                button: "启动SSVEP巡航",
                notes: ["建议先看左/右移动到目标航道", "再看动作目标发射", "敌机每两次指令推进一格"]
            },
            create: createSpaceShooter
        },
        coin_catcher: {
            title: "接金币躲炸弹",
            subtitle: "SSVEP 分拣：先选篮子位置，再用动作指令确认接或躲。",
            commands: { left: "篮子左移", right: "篮子右移", action: "确认本轮" },
            intro: {
                theme: "start-coin",
                title: "接金币躲炸弹 · SSVEP分拣台",
                body: "物品会停在空中等待你。金币要把篮子移到同一列再确认；炸弹要把篮子移开再确认。",
                button: "启动SSVEP分拣",
                notes: ["没有倒计时", "每轮只需要一次确认", "适合测试稳定识别"]
            },
            create: createCoinCatcher
        },
        lane_racer: {
            title: "三车道赛车",
            subtitle: "SSVEP 路线规划：观察下一格障碍，确认后赛车前进一步。",
            commands: { left: "切左车道", right: "切右车道", action: "前进一格" },
            intro: {
                theme: "start-racer",
                title: "三车道赛车 · SSVEP规划模式",
                body: "赛车不会自动冲出去。你可以慢慢看清下一行路况，选好车道后用动作指令前进。",
                button: "启动SSVEP规划",
                notes: ["每次动作只前进一步", "障碍提前显示", "目标是完成 15 段路线"]
            },
            create: createLaneRacer
        },
        frogger: {
            title: "青蛙过河",
            subtitle: "SSVEP 步进过河：车流按指令节拍移动，不抢你的反应时间。",
            commands: { left: "左跳一格", right: "右跳一格", action: "向前一格" },
            intro: {
                theme: "start-frog",
                title: "青蛙过河 · SSVEP步进模式",
                body: "车流不会连续移动，只有你发出一次指令后才整体移动一拍。可以先观察，再凝视目标。",
                button: "启动SSVEP过河",
                notes: ["每次指令后车流移动一拍", "到达顶部算一次过河", "完成 3 次过河胜利"]
            },
            create: createFrogger
        },
        whack_mole: {
            title: "三轨打地鼠",
            subtitle: "SSVEP 目标选择：地鼠停住等待，选中对应洞位即可。",
            commands: { left: "敲左洞", action: "敲中洞", right: "敲右洞" },
            intro: {
                theme: "start-mole",
                title: "三轨打地鼠 · SSVEP目标选择",
                body: "地鼠不会钻走。它出现在哪个洞，就凝视对应的 SSVEP 目标完成敲击。",
                button: "启动SSVEP敲击",
                notes: ["左/中/右直接对应三个目标", "打错会扣机会", "适合做分类反馈演示"]
            },
            create: createWhackMole
        },
        rhythm_taps: {
            title: "节奏音符",
            subtitle: "SSVEP 音符校准：音符停在轨道上，识别正确才进入下一拍。",
            commands: { left: "左轨音符", action: "中轨音符", right: "右轨音符" },
            intro: {
                theme: "start-rhythm",
                title: "节奏音符 · SSVEP慢拍校准",
                body: "这里不是抢节奏，而是按提示音符逐拍确认。每个音符都会等待你的 SSVEP 识别结果。",
                button: "启动SSVEP慢拍",
                notes: ["音符固定等待", "正确后进入下一拍", "连对会提升连击"]
            },
            create: createRhythmTaps
        },
        snake_turn: {
            title: "贪吃蛇转向版",
            subtitle: "SSVEP 步进贪吃蛇：左右只改变朝向，动作才前进一步。",
            commands: { left: "向左转", right: "向右转", action: "前进一步" },
            intro: {
                theme: "start-snake",
                title: "贪吃蛇转向版 · SSVEP步进蛇",
                body: "蛇不会自己走。你可以先转向，确认方向后再用动作指令前进一步。",
                button: "启动SSVEP步进蛇",
                notes: ["左右是转向，不是平移", "动作才会移动", "吃到 8 个能量点胜利"]
            },
            create: createSnakeTurn
        },
        maze_treasure: {
            title: "迷宫寻宝",
            subtitle: "SSVEP 寻路：左右调整朝向，动作前进一步，收齐宝石到出口。",
            commands: { left: "左转", right: "右转", action: "前进一步" },
            intro: {
                theme: "start-maze",
                title: "迷宫寻宝 · SSVEP寻路模式",
                body: "这是最贴近 SSVEP 的慢速策略游戏。每一步都由一次识别结果决定，没有时间压力。",
                button: "启动SSVEP寻宝",
                notes: ["先看方向箭头", "再凝视左/右/动作目标", "收齐 3 个宝石后到出口"]
            },
            create: createMazeTreasure
        }
    };

    function createSpaceShooter() {
        const rows = [116, 206, 296, 386];
        let shipLane;
        let enemies;
        let score;
        let shield;
        let commandCount;
        let destroyed;
        let feedback;
        let finished;

        function reset() {
            shipLane = 1;
            enemies = [];
            score = 0;
            shield = 3;
            commandCount = 0;
            destroyed = 0;
            feedback = makeFeedbackState();
            finished = null;
            spawnEnemy();
            spawnEnemy();
        }

        function spawnEnemy() {
            const occupied = new Set(enemies.filter((enemy) => enemy.row === 0).map((enemy) => enemy.lane));
            const available = [0, 1, 2].filter((lane) => !occupied.has(lane));
            if (available.length === 0) {
                return;
            }
            enemies.push({ lane: sample(available), row: 0, hp: Math.random() < 0.25 ? 2 : 1 });
        }

        function advanceEnemies() {
            for (let i = enemies.length - 1; i >= 0; i -= 1) {
                enemies[i].row += 1;
                if (enemies[i].row >= rows.length) {
                    shield -= 1;
                    enemies.splice(i, 1);
                    setFeedback(feedback, "敌机突破防线", "#ff6b6b");
                }
            }
            if (Math.random() < 0.82) {
                spawnEnemy();
            }
        }

        function afterCommand() {
            commandCount += 1;
            if (commandCount % 2 === 0) {
                advanceEnemies();
            }
            if (destroyed >= 12) {
                finished = { kind: "won", title: "巡航完成", text: `击落 ${destroyed} 架，得分 ${score}` };
            } else if (shield <= 0) {
                finished = { kind: "over", title: "防线失守", text: `击落 ${destroyed} 架，得分 ${score}` };
            }
        }

        function input(action) {
            if (action === "left") {
                shipLane = clamp(shipLane - 1, 0, 2);
                setFeedback(feedback, "飞船左移一格", "#9df4d6");
                afterCommand();
                return;
            }
            if (action === "right") {
                shipLane = clamp(shipLane + 1, 0, 2);
                setFeedback(feedback, "飞船右移一格", "#9df4d6");
                afterCommand();
                return;
            }
            if (action === "action") {
                const targets = enemies
                    .filter((enemy) => enemy.lane === shipLane)
                    .sort((a, b) => b.row - a.row);
                if (targets.length === 0) {
                    setFeedback(feedback, "当前航道没有目标", "#f5bd4f");
                } else {
                    targets[0].hp -= 1;
                    if (targets[0].hp <= 0) {
                        enemies.splice(enemies.indexOf(targets[0]), 1);
                        destroyed += 1;
                        score += 50;
                        setFeedback(feedback, "命中目标", "#42c9a2");
                    } else {
                        score += 20;
                        setFeedback(feedback, "护甲受损，再补一发", "#f5bd4f");
                    }
                }
                afterCommand();
            }
        }

        function update(dt) {
            updateFeedback(feedback, dt);
        }

        function draw(ctx) {
            drawBackground(ctx, "#07111f", "#12172a");
            ctx.strokeStyle = "rgba(255,255,255,0.16)";
            ctx.lineWidth = 2;
            for (let lane = 0; lane < 3; lane += 1) {
                const x = makeLaneX(lane);
                ctx.fillStyle = lane === shipLane ? "rgba(66,201,162,0.13)" : "rgba(255,255,255,0.04)";
                fillRoundRect(ctx, x - 82, 92, 164, 386, 8);
                drawSmallText(ctx, `航道 ${lane + 1}`, x, 518, "#9facbd");
            }

            enemies.forEach((enemy) => {
                const x = makeLaneX(enemy.lane);
                const y = rows[enemy.row];
                ctx.fillStyle = enemy.hp > 1 ? "#ff986b" : "#d1dae8";
                ctx.beginPath();
                ctx.moveTo(x, y - 28);
                ctx.lineTo(x + 34, y + 26);
                ctx.lineTo(x - 34, y + 26);
                ctx.closePath();
                ctx.fill();
                drawSmallText(ctx, enemy.hp > 1 ? "2" : "1", x, y + 7, "#081019");
            });

            const sx = makeLaneX(shipLane);
            ctx.fillStyle = "#42c9a2";
            ctx.beginPath();
            ctx.moveTo(sx, 440);
            ctx.lineTo(sx + 42, 496);
            ctx.lineTo(sx + 12, 484);
            ctx.lineTo(sx, 510);
            ctx.lineTo(sx - 12, 484);
            ctx.lineTo(sx - 42, 496);
            ctx.closePath();
            ctx.fill();
            drawFeedback(ctx, feedback.text, feedback.color);
        }

        function hud() {
            return { 击落: `${destroyed}/12`, 护盾: shield, 分数: score, 指令: commandCount };
        }

        reset();
        return { reset, input, update, draw, hud, get finished() { return finished; } };
    }

    function createCoinCatcher() {
        let lane;
        let item;
        let round;
        let score;
        let chances;
        let feedback;
        let finished;

        function nextItem() {
            item = {
                lane: randInt(0, 2),
                type: Math.random() < 0.68 ? "coin" : "bomb"
            };
        }

        function reset() {
            lane = 1;
            round = 1;
            score = 0;
            chances = 4;
            feedback = makeFeedbackState();
            finished = null;
            nextItem();
        }

        function resolveRound() {
            const sameLane = lane === item.lane;
            if (item.type === "coin" && sameLane) {
                score += 15;
                setFeedback(feedback, "金币接住了", "#42c9a2");
            } else if (item.type === "coin") {
                chances -= 1;
                setFeedback(feedback, "金币落空", "#ff6b6b");
            } else if (item.type === "bomb" && !sameLane) {
                score += 10;
                setFeedback(feedback, "成功避开炸弹", "#42c9a2");
            } else {
                chances -= 1;
                setFeedback(feedback, "接到了炸弹", "#ff6b6b");
            }
            round += 1;
            if (round > 18) {
                finished = { kind: "won", title: "分拣完成", text: `得分 ${score}，剩余机会 ${chances}` };
            } else if (chances <= 0) {
                finished = { kind: "over", title: "机会用完", text: `完成到第 ${round} 轮，得分 ${score}` };
            } else {
                nextItem();
            }
        }

        function input(action) {
            if (action === "left") {
                lane = clamp(lane - 1, 0, 2);
                setFeedback(feedback, "篮子左移", "#9df4d6");
            } else if (action === "right") {
                lane = clamp(lane + 1, 0, 2);
                setFeedback(feedback, "篮子右移", "#9df4d6");
            } else if (action === "action") {
                resolveRound();
            }
        }

        function update(dt) {
            updateFeedback(feedback, dt);
        }

        function draw(ctx) {
            drawBackground(ctx, "#102019", "#101722");
            for (let i = 0; i < 3; i += 1) {
                const x = makeLaneX(i);
                ctx.fillStyle = i === lane ? "rgba(66,201,162,0.15)" : "rgba(255,255,255,0.05)";
                fillRoundRect(ctx, x - 85, 120, 170, 350, 8);
                ctx.strokeStyle = item.lane === i ? "rgba(245,189,79,0.8)" : "rgba(255,255,255,0.12)";
                ctx.lineWidth = 3;
                ctx.strokeRect(x - 86, 119, 172, 352);
            }

            const itemX = makeLaneX(item.lane);
            if (item.type === "coin") {
                ctx.fillStyle = "#f5bd4f";
                ctx.beginPath();
                ctx.arc(itemX, 198, 38, 0, TAU);
                ctx.fill();
                drawSmallText(ctx, "金币", itemX, 205, "#1a1304");
            } else {
                ctx.fillStyle = "#252b35";
                ctx.beginPath();
                ctx.arc(itemX, 198, 38, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = "#ff6b6b";
                ctx.lineWidth = 5;
                ctx.stroke();
                drawSmallText(ctx, "炸弹", itemX, 205, "#ffb6b6");
            }

            const bx = makeLaneX(lane);
            ctx.fillStyle = "#42c9a2";
            fillRoundRect(ctx, bx - 70, 438, 140, 42, 11);
            ctx.fillStyle = "#0c1514";
            fillRoundRect(ctx, bx - 52, 449, 104, 12, 6);
            drawFeedback(ctx, feedback.text, feedback.color);
        }

        function hud() {
            return { 轮次: `${round}/18`, 机会: chances, 分数: score, 目标: item.type === "coin" ? "接金币" : "躲炸弹" };
        }

        reset();
        return { reset, input, update, draw, hud, get finished() { return finished; } };
    }

    function createLaneRacer() {
        const lanes = [0, 1, 2];
        let carLane;
        let rows;
        let distance;
        let armor;
        let score;
        let feedback;
        let finished;

        function makeRow() {
            const blocked = new Set();
            blocked.add(randInt(0, 2));
            if (Math.random() < 0.22) {
                blocked.add(randInt(0, 2));
            }
            const open = lanes.filter((lane) => !blocked.has(lane));
            return { blocked: [...blocked], bonus: Math.random() < 0.4 ? sample(open.length ? open : lanes) : -1 };
        }

        function reset() {
            carLane = 1;
            rows = [makeRow(), makeRow(), makeRow(), makeRow(), makeRow()];
            distance = 0;
            armor = 3;
            score = 0;
            feedback = makeFeedbackState();
            finished = null;
        }

        function advance() {
            const next = rows.shift();
            distance += 1;
            if (next.blocked.includes(carLane)) {
                armor -= 1;
                setFeedback(feedback, "撞上障碍", "#ff6b6b");
            } else if (next.bonus === carLane) {
                score += 25;
                setFeedback(feedback, "收集能量", "#42c9a2");
            } else {
                score += 10;
                setFeedback(feedback, "安全前进", "#9df4d6");
            }
            rows.push(makeRow());
            if (distance >= 15) {
                finished = { kind: "won", title: "路线完成", text: `得分 ${score}，装甲 ${armor}` };
            } else if (armor <= 0) {
                finished = { kind: "over", title: "车辆损坏", text: `前进 ${distance} 段，得分 ${score}` };
            }
        }

        function input(action) {
            if (action === "left") {
                carLane = clamp(carLane - 1, 0, 2);
                setFeedback(feedback, "切到左侧车道", "#9df4d6");
            } else if (action === "right") {
                carLane = clamp(carLane + 1, 0, 2);
                setFeedback(feedback, "切到右侧车道", "#9df4d6");
            } else if (action === "action") {
                advance();
            }
        }

        function update(dt) {
            updateFeedback(feedback, dt);
        }

        function draw(ctx) {
            drawBackground(ctx, "#15191d", "#0b1115");
            ctx.fillStyle = "#242b31";
            fillRoundRect(ctx, 180, 82, 540, 450, 8);
            for (let laneIndex = 0; laneIndex < 3; laneIndex += 1) {
                const x = makeLaneX(laneIndex);
                ctx.fillStyle = laneIndex === carLane ? "rgba(66,201,162,0.14)" : "rgba(255,255,255,0.03)";
                ctx.fillRect(x - 85, 86, 170, 442);
                drawSmallText(ctx, `车道 ${laneIndex + 1}`, x, 560, "#9facbd");
            }
            ctx.strokeStyle = "rgba(255,255,255,0.28)";
            ctx.setLineDash([28, 24]);
            ctx.lineWidth = 4;
            [365, 535].forEach((x) => {
                ctx.beginPath();
                ctx.moveTo(x, 92);
                ctx.lineTo(x, 524);
                ctx.stroke();
            });
            ctx.setLineDash([]);

            rows.forEach((row, rowIndex) => {
                const y = 128 + rowIndex * 74;
                row.blocked.forEach((laneIndex) => {
                    const x = makeLaneX(laneIndex);
                    ctx.fillStyle = rowIndex === 0 ? "#ff6b6b" : "#8a5961";
                    fillRoundRect(ctx, x - 46, y - 25, 92, 50, 9);
                    drawSmallText(ctx, "障碍", x, y + 6, "#fff2f2");
                });
                if (row.bonus >= 0 && !row.blocked.includes(row.bonus)) {
                    const x = makeLaneX(row.bonus);
                    ctx.fillStyle = "#f5bd4f";
                    ctx.beginPath();
                    ctx.arc(x, y, 22, 0, TAU);
                    ctx.fill();
                }
            });

            const carX = makeLaneX(carLane);
            ctx.fillStyle = "#42c9a2";
            fillRoundRect(ctx, carX - 38, 470, 76, 90, 12);
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            fillRoundRect(ctx, carX - 25, 485, 50, 22, 6);
            drawFeedback(ctx, feedback.text, feedback.color);
        }

        function hud() {
            return { 路段: `${distance}/15`, 装甲: armor, 分数: score, 当前: `车道${carLane + 1}` };
        }

        reset();
        return { reset, input, update, draw, hud, get finished() { return finished; } };
    }

    function createFrogger() {
        const cols = 9;
        const rows = 7;
        const cell = 64;
        const ox = (W - cols * cell) / 2;
        const oy = 86;
        let frog;
        let traffic;
        let lives;
        let crossings;
        let steps;
        let feedback;
        let finished;

        function makeTraffic() {
            traffic = [];
            for (let row = 1; row <= 5; row += 1) {
                traffic.push({
                    row,
                    dir: row % 2 === 0 ? 1 : -1,
                    cars: [randInt(0, cols - 1), randInt(0, cols - 1)]
                });
            }
        }

        function resetFrog() {
            frog = { col: 4, row: 6 };
        }

        function reset() {
            lives = 3;
            crossings = 0;
            steps = 0;
            feedback = makeFeedbackState();
            finished = null;
            resetFrog();
            makeTraffic();
        }

        function shiftTraffic() {
            traffic.forEach((line) => {
                line.cars = line.cars.map((col) => (col + line.dir + cols) % cols);
            });
        }

        function checkCollision() {
            const line = traffic.find((item) => item.row === frog.row);
            if (line && line.cars.includes(frog.col)) {
                lives -= 1;
                setFeedback(feedback, "被车流挡住，回到起点", "#ff6b6b");
                resetFrog();
            }
        }

        function afterStep() {
            steps += 1;
            shiftTraffic();
            checkCollision();
            if (lives <= 0) {
                finished = { kind: "over", title: "过河失败", text: `完成 ${crossings} 次过河` };
            } else if (crossings >= 3) {
                finished = { kind: "won", title: "顺利过河", text: `总步数 ${steps}` };
            }
        }

        function input(action) {
            if (action === "left") {
                frog.col = clamp(frog.col - 1, 0, cols - 1);
                setFeedback(feedback, "左跳一格", "#9df4d6");
                afterStep();
            } else if (action === "right") {
                frog.col = clamp(frog.col + 1, 0, cols - 1);
                setFeedback(feedback, "右跳一格", "#9df4d6");
                afterStep();
            } else if (action === "action") {
                frog.row = clamp(frog.row - 1, 0, rows - 1);
                if (frog.row === 0) {
                    crossings += 1;
                    setFeedback(feedback, "到达对岸", "#42c9a2");
                    resetFrog();
                    makeTraffic();
                } else {
                    setFeedback(feedback, "向前一格", "#9df4d6");
                }
                afterStep();
            }
        }

        function update(dt) {
            updateFeedback(feedback, dt);
        }

        function draw(ctx) {
            drawBackground(ctx, "#102218", "#091116");
            for (let r = 0; r < rows; r += 1) {
                ctx.fillStyle = r === 0 ? "#1d7355" : r === rows - 1 ? "#24563d" : r % 2 ? "#252d35" : "#303842";
                ctx.fillRect(ox, oy + r * cell, cols * cell, cell - 4);
            }
            traffic.forEach((line) => {
                line.cars.forEach((col) => {
                    const x = ox + col * cell + 7;
                    const y = oy + line.row * cell + 13;
                    ctx.fillStyle = line.dir > 0 ? "#f5bd4f" : "#ff6b6b";
                    fillRoundRect(ctx, x, y, cell - 14, 34, 8);
                });
            });
            const fx = ox + frog.col * cell + cell / 2;
            const fy = oy + frog.row * cell + cell / 2;
            ctx.fillStyle = "#42c9a2";
            ctx.beginPath();
            ctx.ellipse(fx, fy, 23, 18, 0, 0, TAU);
            ctx.fill();
            drawText(ctx, "GOAL", W / 2, oy + 40, 22, "rgba(255,255,255,0.78)");
            drawFeedback(ctx, feedback.text, feedback.color);
        }

        function hud() {
            return { 过河: `${crossings}/3`, 生命: lives, 步数: steps };
        }

        reset();
        return { reset, input, update, draw, hud, get finished() { return finished; } };
    }

    function createWhackMole() {
        let activeLane;
        let score;
        let combo;
        let misses;
        let hits;
        let feedback;
        let finished;

        function nextMole() {
            activeLane = randInt(0, 2);
        }

        function reset() {
            score = 0;
            combo = 0;
            misses = 0;
            hits = 0;
            feedback = makeFeedbackState();
            finished = null;
            nextMole();
        }

        function actionLane(action) {
            if (action === "left") return 0;
            if (action === "action") return 1;
            if (action === "right") return 2;
            return -1;
        }

        function input(action) {
            const lane = actionLane(action);
            if (lane < 0) return;
            if (lane === activeLane) {
                combo += 1;
                hits += 1;
                score += 10 + combo * 3;
                setFeedback(feedback, "命中目标", "#42c9a2");
            } else {
                combo = 0;
                misses += 1;
                setFeedback(feedback, "敲错洞位", "#ff6b6b");
            }
            if (hits >= 18) {
                finished = { kind: "won", title: "目标选择完成", text: `得分 ${score}，错误 ${misses}` };
            } else if (misses >= 6) {
                finished = { kind: "over", title: "错误过多", text: `命中 ${hits} 次，得分 ${score}` };
            } else {
                nextMole();
            }
        }

        function update(dt) {
            updateFeedback(feedback, dt);
        }

        function draw(ctx) {
            drawBackground(ctx, "#17251b", "#10151d");
            ctx.fillStyle = "#263524";
            ctx.fillRect(0, 420, W, 200);
            for (let lane = 0; lane < 3; lane += 1) {
                const x = makeLaneX(lane);
                ctx.fillStyle = activeLane === lane ? "rgba(245,189,79,0.18)" : "rgba(255,255,255,0.04)";
                fillRoundRect(ctx, x - 95, 142, 190, 300, 8);
                ctx.fillStyle = "#090b0f";
                ctx.beginPath();
                ctx.ellipse(x, 402, 78, 25, 0, 0, TAU);
                ctx.fill();
                if (activeLane === lane) {
                    ctx.fillStyle = "#b98354";
                    ctx.beginPath();
                    ctx.ellipse(x, 350, 46, 58, 0, Math.PI, TAU);
                    ctx.lineTo(x + 46, 404);
                    ctx.lineTo(x - 46, 404);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = "#18110d";
                    ctx.beginPath();
                    ctx.arc(x - 14, 335, 5, 0, TAU);
                    ctx.arc(x + 14, 335, 5, 0, TAU);
                    ctx.fill();
                }
                drawSmallText(ctx, lane === 0 ? "左洞" : lane === 1 ? "中洞" : "右洞", x, 500, "#d9e5f3");
            }
            drawFeedback(ctx, feedback.text, feedback.color);
        }

        function hud() {
            return { 命中: `${hits}/18`, 错误: misses, 连击: combo, 分数: score };
        }

        reset();
        return { reset, input, update, draw, hud, get finished() { return finished; } };
    }

    function createRhythmTaps() {
        let sequence;
        let index;
        let score;
        let combo;
        let mistakes;
        let stage;
        let feedback;
        let finished;

        function makeSequence() {
            sequence = Array.from({ length: 8 }, () => randInt(0, 2));
            index = 0;
        }

        function reset() {
            score = 0;
            combo = 0;
            mistakes = 0;
            stage = 1;
            feedback = makeFeedbackState();
            finished = null;
            makeSequence();
        }

        function actionLane(action) {
            if (action === "left") return 0;
            if (action === "action") return 1;
            if (action === "right") return 2;
            return -1;
        }

        function input(action) {
            const lane = actionLane(action);
            if (lane < 0) return;
            if (lane === sequence[index]) {
                combo += 1;
                score += 12 + combo * 2;
                index += 1;
                setFeedback(feedback, "音符正确", "#42c9a2");
                if (index >= sequence.length) {
                    stage += 1;
                    if (stage > 4) {
                        finished = { kind: "won", title: "慢拍校准完成", text: `得分 ${score}，错误 ${mistakes}` };
                    } else {
                        makeSequence();
                        setFeedback(feedback, `进入第 ${stage} 段`, "#f5bd4f");
                    }
                }
            } else {
                combo = 0;
                mistakes += 1;
                setFeedback(feedback, "音轨选择错误", "#ff6b6b");
                if (mistakes >= 7) {
                    finished = { kind: "over", title: "错误过多", text: `到达第 ${stage} 段，得分 ${score}` };
                }
            }
        }

        function update(dt) {
            updateFeedback(feedback, dt);
        }

        function draw(ctx) {
            drawBackground(ctx, "#101426", "#07131c");
            for (let lane = 0; lane < 3; lane += 1) {
                const x = makeLaneX(lane);
                ctx.fillStyle = sequence[index] === lane ? "rgba(66,201,162,0.15)" : "rgba(255,255,255,0.05)";
                fillRoundRect(ctx, x - 82, 104, 164, 366, 8);
                ctx.strokeStyle = sequence[index] === lane ? "#42c9a2" : "rgba(255,255,255,0.14)";
                ctx.lineWidth = 4;
                ctx.strokeRect(x - 83, 103, 166, 368);
                drawSmallText(ctx, lane === 0 ? "左轨" : lane === 1 ? "中轨" : "右轨", x, 506, "#d9e5f3");
            }
            sequence.forEach((lane, i) => {
                const x = 240 + i * 60;
                ctx.fillStyle = i < index ? "#42c9a2" : i === index ? "#f5bd4f" : "rgba(255,255,255,0.14)";
                ctx.beginPath();
                ctx.arc(x, 72, 18, 0, TAU);
                ctx.fill();
                drawSmallText(ctx, lane === 0 ? "左" : lane === 1 ? "中" : "右", x, 78, i < index ? "#07110e" : "#eef4fb");
            });
            const tx = makeLaneX(sequence[index]);
            ctx.fillStyle = "#f5bd4f";
            ctx.beginPath();
            ctx.arc(tx, 292, 54, 0, TAU);
            ctx.fill();
            drawText(ctx, sequence[index] === 0 ? "左" : sequence[index] === 1 ? "中" : "右", tx, 306, 34, "#101318");
            drawFeedback(ctx, feedback.text, feedback.color);
        }

        function hud() {
            return { 段落: `${stage}/4`, 进度: `${index + 1}/8`, 错误: mistakes, 连击: combo };
        }

        reset();
        return { reset, input, update, draw, hud, get finished() { return finished; } };
    }

    function createSnakeTurn() {
        const cols = 17;
        const rows = 11;
        const cell = 34;
        const ox = (W - cols * cell) / 2;
        const oy = 104;
        const dirs = [
            { x: 0, y: -1, label: "上" },
            { x: 1, y: 0, label: "右" },
            { x: 0, y: 1, label: "下" },
            { x: -1, y: 0, label: "左" }
        ];
        let snake;
        let facing;
        let food;
        let score;
        let steps;
        let feedback;
        let finished;

        function placeFood() {
            do {
                food = { x: randInt(0, cols - 1), y: randInt(0, rows - 1) };
            } while (snake.some((part) => part.x === food.x && part.y === food.y));
        }

        function reset() {
            snake = [{ x: 8, y: 5 }, { x: 7, y: 5 }, { x: 6, y: 5 }];
            facing = 1;
            score = 0;
            steps = 0;
            feedback = makeFeedbackState();
            finished = null;
            placeFood();
        }

        function moveForward() {
            const d = dirs[facing];
            const head = snake[0];
            const next = { x: head.x + d.x, y: head.y + d.y };
            steps += 1;
            if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows || snake.some((part) => part.x === next.x && part.y === next.y)) {
                finished = { kind: "over", title: "蛇撞到了", text: `吃到 ${score}/8 个能量点` };
                return;
            }
            snake.unshift(next);
            if (next.x === food.x && next.y === food.y) {
                score += 1;
                setFeedback(feedback, "吃到能量点", "#42c9a2");
                if (score >= 8) {
                    finished = { kind: "won", title: "步进蛇完成", text: `总步数 ${steps}` };
                } else {
                    placeFood();
                }
            } else {
                snake.pop();
                setFeedback(feedback, "前进一步", "#9df4d6");
            }
        }

        function input(action) {
            if (action === "left") {
                facing = (facing + 3) % 4;
                setFeedback(feedback, `转向${dirs[facing].label}`, "#f5bd4f");
            } else if (action === "right") {
                facing = (facing + 1) % 4;
                setFeedback(feedback, `转向${dirs[facing].label}`, "#f5bd4f");
            } else if (action === "action") {
                moveForward();
            }
        }

        function update(dt) {
            updateFeedback(feedback, dt);
        }

        function draw(ctx) {
            drawBackground(ctx, "#0f1d19", "#10141a");
            ctx.fillStyle = "#07100d";
            fillRoundRect(ctx, ox - 12, oy - 12, cols * cell + 24, rows * cell + 24, 8);
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            for (let c = 0; c <= cols; c += 1) {
                ctx.beginPath();
                ctx.moveTo(ox + c * cell, oy);
                ctx.lineTo(ox + c * cell, oy + rows * cell);
                ctx.stroke();
            }
            for (let r = 0; r <= rows; r += 1) {
                ctx.beginPath();
                ctx.moveTo(ox, oy + r * cell);
                ctx.lineTo(ox + cols * cell, oy + r * cell);
                ctx.stroke();
            }
            ctx.fillStyle = "#f5bd4f";
            ctx.beginPath();
            ctx.arc(ox + food.x * cell + cell / 2, oy + food.y * cell + cell / 2, 11, 0, TAU);
            ctx.fill();
            snake.forEach((part, index) => {
                ctx.fillStyle = index === 0 ? "#9df4d6" : "#42c9a2";
                fillRoundRect(ctx, ox + part.x * cell + 4, oy + part.y * cell + 4, cell - 8, cell - 8, 7);
            });
            const head = snake[0];
            const d = dirs[facing];
            ctx.strokeStyle = "#101318";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(ox + head.x * cell + cell / 2, oy + head.y * cell + cell / 2);
            ctx.lineTo(ox + head.x * cell + cell / 2 + d.x * 12, oy + head.y * cell + cell / 2 + d.y * 12);
            ctx.stroke();
            drawFeedback(ctx, feedback.text, feedback.color);
        }

        function hud() {
            return { 能量: `${score}/8`, 方向: dirs[facing].label, 步数: steps, 长度: snake.length };
        }

        reset();
        return { reset, input, update, draw, hud, get finished() { return finished; } };
    }

    function createMazeTreasure() {
        const maze = [
            "###############",
            "#S....#....#..#",
            "#.###.#.##.#..#",
            "#...#...#.....#",
            "###.#####.###.#",
            "#...#...#...#.#",
            "#.#.#.#.###.#.#",
            "#.#...#.....#.#",
            "#.#####.#####.#",
            "#.....#....T.E#",
            "###############"
        ];
        const cell = 42;
        const rows = maze.length;
        const cols = maze[0].length;
        const ox = (W - cols * cell) / 2;
        const oy = 72;
        const dirs = [
            { x: 0, y: -1, label: "上" },
            { x: 1, y: 0, label: "右" },
            { x: 0, y: 1, label: "下" },
            { x: -1, y: 0, label: "左" }
        ];
        let player;
        let facing;
        let treasures;
        let moves;
        let bumps;
        let feedback;
        let finished;

        function reset() {
            player = { x: 1, y: 1 };
            facing = 1;
            treasures = [
                { x: 5, y: 3, got: false },
                { x: 1, y: 9, got: false },
                { x: 12, y: 9, got: false }
            ];
            moves = 0;
            bumps = 0;
            feedback = makeFeedbackState();
            finished = null;
        }

        function isWall(x, y) {
            return y < 0 || y >= rows || x < 0 || x >= cols || maze[y][x] === "#";
        }

        function input(action) {
            if (action === "left") {
                facing = (facing + 3) % 4;
                setFeedback(feedback, `转向${dirs[facing].label}`, "#f5bd4f");
            } else if (action === "right") {
                facing = (facing + 1) % 4;
                setFeedback(feedback, `转向${dirs[facing].label}`, "#f5bd4f");
            } else if (action === "action") {
                const d = dirs[facing];
                const nx = player.x + d.x;
                const ny = player.y + d.y;
                if (isWall(nx, ny)) {
                    bumps += 1;
                    setFeedback(feedback, "前方是墙", "#ff6b6b");
                    return;
                }
                player.x = nx;
                player.y = ny;
                moves += 1;
                setFeedback(feedback, "前进一步", "#9df4d6");
                treasures.forEach((gem) => {
                    if (gem.x === player.x && gem.y === player.y) {
                        gem.got = true;
                        setFeedback(feedback, "拿到宝石", "#42c9a2");
                    }
                });
                if (player.x === 13 && player.y === 9 && treasures.every((gem) => gem.got)) {
                    finished = { kind: "won", title: "寻宝完成", text: `步数 ${moves}，撞墙 ${bumps} 次` };
                }
            }
        }

        function update(dt) {
            updateFeedback(feedback, dt);
        }

        function draw(ctx) {
            drawBackground(ctx, "#101721", "#081016");
            for (let y = 0; y < rows; y += 1) {
                for (let x = 0; x < cols; x += 1) {
                    const px = ox + x * cell;
                    const py = oy + y * cell;
                    if (maze[y][x] === "#") {
                        ctx.fillStyle = "#263044";
                        fillRoundRect(ctx, px + 2, py + 2, cell - 4, cell - 4, 5);
                    } else {
                        ctx.fillStyle = "#101b24";
                        ctx.fillRect(px, py, cell, cell);
                    }
                }
            }
            ctx.fillStyle = "#3a8f73";
            fillRoundRect(ctx, ox + 13 * cell + 6, oy + 9 * cell + 6, cell - 12, cell - 12, 8);
            drawSmallText(ctx, "出", ox + 13 * cell + cell / 2, oy + 9 * cell + 27, "#eef4fb");
            treasures.forEach((gem) => {
                if (gem.got) return;
                const gx = ox + gem.x * cell + cell / 2;
                const gy = oy + gem.y * cell + cell / 2;
                ctx.fillStyle = "#f5bd4f";
                ctx.beginPath();
                ctx.moveTo(gx, gy - 15);
                ctx.lineTo(gx + 15, gy);
                ctx.lineTo(gx, gy + 15);
                ctx.lineTo(gx - 15, gy);
                ctx.closePath();
                ctx.fill();
            });
            const px = ox + player.x * cell + cell / 2;
            const py = oy + player.y * cell + cell / 2;
            ctx.fillStyle = "#42c9a2";
            ctx.beginPath();
            ctx.arc(px, py, 15, 0, TAU);
            ctx.fill();
            const d = dirs[facing];
            ctx.strokeStyle = "#dff8ff";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + d.x * 18, py + d.y * 18);
            ctx.stroke();
            drawFeedback(ctx, feedback.text, feedback.color);
        }

        function hud() {
            return { 宝石: `${treasures.filter((gem) => gem.got).length}/3`, 方向: dirs[facing].label, 步数: moves, 撞墙: bumps };
        }

        reset();
        return { reset, input, update, draw, hud, get finished() { return finished; } };
    }

    function renderIntro(definition) {
        const commandRows = ["1", "2", "3"].map((raw) => {
            const action = window.SSVEPInput.mapRawCommand(raw);
            const label = definition.commands[action] || "-";
            return `<span class="intro-command"><strong>${raw}</strong>${label}</span>`;
        }).join("");
        const notes = definition.intro.notes.map((note) => `<span class="intro-note">${note}</span>`).join("");
        return `
            <span class="intro-body">${definition.intro.body}</span>
            <span class="intro-command-row">${commandRows}</span>
            <span class="intro-note-row">${notes}</span>
        `;
    }

    function setupShell() {
        const id = window.GAME_ID;
        const definition = games[id];
        if (!definition) {
            return;
        }

        const canvas = document.getElementById("gameCanvas");
        const ctx = canvas.getContext("2d");
        const title = document.getElementById("gameTitle");
        const subtitle = document.getElementById("gameSubtitle");
        const hudEl = document.getElementById("hud");
        const commandPills = document.getElementById("commandPills");
        const connection = document.getElementById("connection");
        const profileSelect = document.getElementById("profileSelect");
        const overlay = document.getElementById("overlay");
        const overlayPanel = overlay.querySelector(".overlay-panel");
        const overlayTitle = document.getElementById("overlayTitle");
        const overlayText = document.getElementById("overlayText");
        const overlayButton = document.getElementById("overlayButton");

        title.textContent = definition.title;
        subtitle.textContent = definition.subtitle;
        document.title = `${definition.title} - SSVEP小游戏`;

        const game = definition.create();
        let state = "ready";
        let lastTime = performance.now();

        function renderCommands() {
            const rows = ["1", "2", "3"].map((raw) => {
                const action = window.SSVEPInput.mapRawCommand(raw);
                return `<span class="command-pill"><span class="command-key">${raw}</span>${definition.commands[action] || action || "-"}</span>`;
            });
            commandPills.innerHTML = rows.join("");
        }

        function renderHud() {
            const stats = game.hud();
            hudEl.innerHTML = Object.keys(stats).map((key) => {
                return `<div class="hud-item"><span class="hud-label">${key}</span><span class="hud-value">${stats[key]}</span></div>`;
            }).join("");
        }

        function showStartOverlay() {
            state = "ready";
            overlay.classList.add("is-visible");
            overlayPanel.className = `overlay-panel start-panel ${definition.intro.theme}`;
            overlayTitle.textContent = definition.intro.title;
            overlayText.innerHTML = renderIntro(definition);
            overlayButton.textContent = definition.intro.button;
        }

        function showFinishOverlay(result) {
            overlay.classList.add("is-visible");
            overlayPanel.className = `overlay-panel start-panel ${definition.intro.theme}`;
            overlayTitle.textContent = result.title;
            overlayText.innerHTML = `<span class="intro-body">${result.text}</span><span class="intro-note-row"><span class="intro-note">点击按钮后重新进入本游戏的 SSVEP 开始界面。</span></span>`;
            overlayButton.textContent = "回到SSVEP开始";
        }

        function hideOverlay() {
            overlay.classList.remove("is-visible");
        }

        function startGame() {
            game.reset();
            state = "playing";
            lastTime = performance.now();
            hideOverlay();
        }

        overlayButton.addEventListener("click", function () {
            if (state === "playing") {
                return;
            }
            if (state === "ready") {
                startGame();
            } else {
                game.reset();
                showStartOverlay();
            }
        });

        window.addEventListener("keydown", function (event) {
            if (event.key === "r" || event.key === "R") {
                game.reset();
                showStartOverlay();
            }
        });

        function handleCommand(action) {
            if (state !== "playing") {
                return;
            }
            game.input(action);
        }

        window.SSVEPInput.getProfiles().forEach((profile) => {
            const option = document.createElement("option");
            option.value = profile.name;
            option.textContent = profile.label;
            profileSelect.appendChild(option);
        });
        profileSelect.value = window.SSVEPInput.getProfile();
        profileSelect.addEventListener("change", function () {
            window.SSVEPInput.setProfile(profileSelect.value);
            renderCommands();
            if (state === "ready") {
                overlayText.innerHTML = renderIntro(definition);
            }
        });

        window.SSVEPInput.onCommand(handleCommand);
        window.SSVEPInput.onStatus(function (status, detail) {
            if (status === "profile") {
                renderCommands();
                if (state === "ready") {
                    overlayText.innerHTML = renderIntro(definition);
                }
                return;
            }
            const labels = {
                connecting: "WebSocket 连接中",
                open: "WebSocket 已连接",
                closed: "WebSocket 未连接",
                error: "WebSocket 错误"
            };
            connection.textContent = labels[status] || detail || status;
            connection.dataset.state = status;
        });
        window.SSVEPInput.connect();

        function frame(now) {
            const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
            lastTime = now;
            if (state === "playing") {
                game.update(dt);
                if (game.finished) {
                    state = game.finished.kind === "won" ? "won" : "over";
                    showFinishOverlay(game.finished);
                }
            }
            game.draw(ctx);
            renderHud();
            requestAnimationFrame(frame);
        }

        renderCommands();
        renderHud();
        showStartOverlay();
        requestAnimationFrame(frame);
    }

    window.SSVEPGames = games;
    window.addEventListener("DOMContentLoaded", setupShell);
})();

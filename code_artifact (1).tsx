import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';

// --- 전역 스타일 주입 (레트로 폰트 및 디자인) ---
const globalStyles = `
    @font-face {
        font-family: 'NeoDunggeunmo';
        src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.3/NeoDunggeunmo.woff') format('woff');
        font-weight: normal;
        font-style: normal;
    }
    body {
        font-family: 'NeoDunggeunmo', sans-serif;
        background-color: #000;
        color: #fff;
        user-select: none;
        overflow-x: hidden;
        margin: 0;
        padding: 0;
    }
    .pixel-box {
        background-color: #0000AA;
        border: 4px solid #fff;
        box-shadow: inset -4px -4px 0px 0px rgba(0,0,0,0.5), inset 4px 4px 0px 0px rgba(255,255,255,0.3);
        image-rendering: pixelated;
    }
    .pixel-button {
        background-color: #AA0000;
        color: white;
        border: 4px solid #fff;
        box-shadow: inset -4px -4px 0px 0px rgba(0,0,0,0.5);
        cursor: pointer;
        transition: transform 0.1s;
    }
    .pixel-button:hover {
        background-color: #D40000;
    }
    .pixel-button:active {
        transform: scale(0.95);
        box-shadow: inset 4px 4px 0px 0px rgba(0,0,0,0.5);
    }
    .pixel-input {
        background-color: #000;
        color: #00FF00;
        border: 4px solid #fff;
        padding: 8px;
        outline: none;
        font-family: 'NeoDunggeunmo', sans-serif;
    }
    .pixel-input:focus {
        border-color: #FFFF00;
    }
    .fraction-line {
        border-bottom: 2px solid currentcolor;
    }
    /* 브라운관 TV 스캔라인 효과 */
    .scanlines {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
        background-size: 100% 4px, 6px 100%;
        pointer-events: none;
        z-index: 50;
    }
`;

// --- Firebase 초기화 ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'math-mastery-5th';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 게임 마스터 대사 ---
const GM_MESSAGES = [
    "끈기가 대단하군 도전자여.",
    "훌륭한 성장이 느껴지는군.",
    "마스터의 자리가 멀지 않았다.",
    "포기하지 않는 마음이 가장 큰 무기지.",
    "좋아, 그 기세로 계속 나아가라!",
    "실수에서 배우는 자가 진정한 승자다.",
    "너의 집중력에 경의를 표한다."
];

// --- 수학 문제 생성 로직 ---
const getLCM = (a, b) => {
    let min = Math.min(a, b);
    let max = Math.max(a, b);
    let i = max;
    while (i % min !== 0) { i += max; }
    return i;
};

const generateProblem = () => {
    const isSub = Math.random() > 0.5;
    const isMixed = Math.random() > 0.4; // 60% 대분수, 40% 진분수
    
    const denoms = [[2,3], [3,4], [4,5], [5,6], [2,5], [3,5], [3,8], [4,9]];
    const pair = denoms[Math.floor(Math.random() * denoms.length)];
    let c = pair[0];
    let f = pair[1];
    const L = getLCM(c, f);

    let b = Math.floor(Math.random() * (c - 1)) + 1; // 1 ~ c-1
    let e = Math.floor(Math.random() * (f - 1)) + 1; // 1 ~ f-1

    let num1 = b * (L/c);
    let num2 = e * (L/f);

    let A = 0, D = 0;

    if (isMixed) {
        A = Math.floor(Math.random() * 5) + 3; // 3 ~ 7
        D = Math.floor(Math.random() * (A - 2)) + 1; // 1 ~ A-2
    } else {
        // 진분수 뺄셈의 경우 앞의 숫자가 더 커야 함 (음수 방지)
        if (isSub && (num1 / L < num2 / L)) {
            let temp = b; b = e; e = temp;
            temp = c; c = f; f = temp;
            temp = num1; num1 = num2; num2 = temp;
        }
    }

    const formatFrac = (whole, d, nStr) => {
        if (whole === 0) return `{${nStr}/${d}}`;
        return `${whole} {${nStr}/${d}}`;
    };

    let original = "";
    let steps = [];
    let answers = [];

    if (isSub) {
        original = `${formatFrac(A, c, b)} - ${formatFrac(D, f, e)}`;
        let step1 = `= ${formatFrac(A, L, num1)} - ${formatFrac(D, L, '[ ]')}`;
        answers.push(num2);
        steps.push(step1);

        let finalWhole = A - D;
        let finalNum = num1 - num2;

        if (finalNum < 0) {
            // 대분수 받아내림 과정 1줄 추가
            let borrowStep = `= (${formatFrac(A - 1, L, L)} + ${formatFrac(0, L, '[ ]')}) - ${formatFrac(D, L, '[ ]')}`;
            answers.push(num1); // 원래 분자의 값
            answers.push(num2); // 빼는 분자의 값
            steps.push(borrowStep);

            finalWhole -= 1;
            finalNum += L;
        }
        
        let stepFinal = `= ${formatFrac(finalWhole, L, '[ ]')}`;
        answers.push(finalNum);
        steps.push(stepFinal);
    } else {
        original = `${formatFrac(A, c, b)} + ${formatFrac(D, f, e)}`;
        let step1 = `= ${formatFrac(A, L, num1)} + ${formatFrac(D, L, '[ ]')}`;
        answers.push(num2);
        steps.push(step1);

        let finalWhole = A + D;
        let finalNum = num1 + num2;

        if (finalNum >= L) {
            finalWhole += 1;
            finalNum -= L;
        }

        if (finalNum === 0) {
            return generateProblem(); // 가분수 덧셈이 자연수로 떨어지면 포맷 유지를 위해 재성성
        }

        let stepFinal = `= ${formatFrac(finalWhole, L, '[ ]')}`;
        answers.push(finalNum);
        steps.push(stepFinal);
    }

    return {
        original,
        steps,
        answers
    };
};

const calculateLevel = (xp) => {
    if (xp < 50) return 1;
    if (xp < 100) return 2;
    if (xp < 200) return 3;
    if (xp < 350) return 4;
    if (xp < 550) return 5;
    if (xp < 800) return 6;
    return 7;
};

// --- 컴포넌트들 ---

const FractionText = ({ text }) => {
    const parts = text.split(/(\{.*?\})/g);
    return (
        <div className="flex items-center flex-wrap text-xl md:text-3xl leading-none my-2">
            {parts.map((part, i) => {
                if (part.startsWith('{') && part.endsWith('}')) {
                    const inner = part.slice(1, -1);
                    const [num, den] = inner.split('/');
                    return (
                        <div key={i} className="inline-flex flex-col items-center justify-center align-middle mx-2 text-lg md:text-2xl mt-[-8px]">
                            <span className="fraction-line w-full text-center pb-1 text-[#FFFF00]">
                                {num === '[ ]' ? <span className="text-red-400">[ ]</span> : num}
                            </span>
                            <span className="pt-1 text-[#FFFF00]">{den}</span>
                        </div>
                    );
                }
                return <span key={i} className="whitespace-pre">{part}</span>;
            })}
        </div>
    );
};

const RewardModal = ({ reward, onClose }) => {
    if (!reward) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="pixel-box p-8 max-w-md w-full text-center animate-bounce">
                <div className="text-6xl mb-4">🎁</div>
                <h2 className="text-2xl text-yellow-300 mb-2">{reward.msg}</h2>
                <p className="text-xl mb-6">+{reward.xp} XP 획득!</p>
                <button onClick={onClose} className="pixel-button px-6 py-3 text-xl w-full">계속하기</button>
            </div>
        </div>
    );
};

const GameScreen = ({ user, players, gameState }) => {
    const [problem, setProblem] = useState(null);
    const [input, setInput] = useState('');
    const [feedback, setFeedback] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const [reward, setReward] = useState(null);
    const [gmMsg, setGmMsg] = useState("도전을 환영한다, 낯선이여. 문제를 해결하여 경험치를 모으고 마스터의 자리에 도달하라.");
    
    const me = players.find(p => p.id === user.uid) || { xp: 0, level: 1, name: '알 수 없음' };

    useEffect(() => {
        setProblem(generateProblem());
    }, []);

    const updatePlayerXP = async (xpChange) => {
        const newXp = Math.max(0, me.xp + xpChange);
        const newLevel = calculateLevel(newXp);
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), {
                xp: newXp,
                level: newLevel,
                updatedAt: Date.now()
            });
        } catch(e) {
            console.error("XP update failed", e);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || !problem) return;

        const userAnswers = input.split(',').map(s => parseInt(s.trim()));
        const isCorrect = userAnswers.length === problem.answers.length && 
                          userAnswers.every((ans, i) => ans === problem.answers[i]);

        if (isCorrect) {
            setFeedback('');
            setRetryCount(0);
            
            const rand = Math.random();
            let currentReward;
            if (rand < 0.4) currentReward = { type: 'base', xp: 10, msg: '기본 보상' };
            else if (rand < 0.7) currentReward = { type: 'double', xp: 20, msg: '경험치 2배!' };
            else if (rand < 0.9) currentReward = { type: 'lucky', xp: Math.floor(Math.random() * 51), msg: '행운의 상자!' };
            else currentReward = { type: 'cheer', xp: 30, msg: '도전자 응원 카드!' };
            
            setReward(currentReward);
            updatePlayerXP(currentReward.xp);
            setGmMsg(GM_MESSAGES[Math.floor(Math.random() * GM_MESSAGES.length)]);
        } else {
            if (retryCount === 0) {
                setRetryCount(1);
                setFeedback("틀렸습니다! 다시 계산해 보세요.\n힌트: 공통분모를 만들 때 분자와 분모에 같은 수를 곱했는지 확인하세요.");
                setInput('');
            } else {
                setFeedback(`오답입니다! 정답은 [ ${problem.answers.join(', ')} ] 였습니다. (-5 XP)`);
                updatePlayerXP(-5);
                setTimeout(() => {
                    setProblem(generateProblem());
                    setInput('');
                    setFeedback('');
                    setRetryCount(0);
                }, 3000);
            }
        }
    };

    const handleNext = () => {
        setReward(null);
        setProblem(generateProblem());
        setInput('');
    };

    const myIndex = players.findIndex(p => p.id === user.uid);
    const startIdx = Math.max(0, myIndex - 5);
    const endIdx = Math.min(players.length, startIdx + 11);
    const visiblePlayers = players.slice(startIdx, endIdx);

    if (gameState === 'ended') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black">
                <div className="pixel-box p-8 text-center max-w-2xl w-full">
                    <h1 className="text-4xl text-yellow-300 mb-6">게임 종료!</h1>
                    <p className="text-2xl mb-4">최종 결과</p>
                    <p className="text-xl mb-2 text-green-400">나의 레벨: Lv.{me.level}</p>
                    <p className="text-xl mb-6">최종 경험치: {me.xp} XP</p>
                    <div className="text-left space-y-2 mt-4 max-h-60 overflow-y-auto p-4 bg-black border-2 border-gray-600">
                        {players.map((p, i) => (
                            <div key={p.id} className={`flex justify-between ${p.id === user.uid ? 'text-yellow-300 font-bold' : 'text-gray-300'}`}>
                                <span>{i+1}위. {p.name}</span>
                                <span>Lv.{p.level} ({p.xp}XP)</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row min-h-screen p-4 gap-4 max-w-7xl mx-auto z-10 relative">
            <div className="flex-1 flex flex-col gap-4">
                <div className="pixel-box p-4 flex justify-between items-center bg-blue-900">
                    <div>
                        <span className="text-xl text-yellow-300 mr-4">👤 {me.name}</span>
                        <span className="text-xl text-green-400 mr-4">Lv.{me.level}</span>
                    </div>
                    <div className="text-xl">XP: {me.xp}</div>
                </div>

                <div className="pixel-box p-4 bg-gray-900 border-gray-400 flex items-start gap-4">
                    <div className="text-4xl">🧙‍♂️</div>
                    <div>
                        <p className="text-gray-400 text-sm mb-1">게임 마스터</p>
                        <p className="text-lg leading-relaxed">{gmMsg}</p>
                    </div>
                </div>

                <div className="pixel-box p-6 flex-1 flex flex-col bg-black">
                    <h2 className="text-2xl text-yellow-300 mb-6">Q. 다음을 계산하시오.</h2>
                    {problem && (
                        <div className="flex-1">
                            <div className="mb-6 border-b-2 border-gray-700 pb-4">
                                <FractionText text={problem.original} />
                            </div>
                            <div className="space-y-4 pl-4 border-l-4 border-blue-800">
                                {problem.steps.map((step, idx) => (
                                    <FractionText key={idx} text={step} />
                                ))}
                            </div>
                        </div>
                    )}

                    {feedback && (
                        <div className={`mt-6 p-4 border-2 ${retryCount > 0 && !feedback.includes('정답은') ? 'border-yellow-500 text-yellow-300' : 'border-red-500 text-red-400'} bg-black`}>
                            {feedback.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="mt-8 flex gap-2 flex-col sm:flex-row">
                        <input 
                            type="text" 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="빈칸의 숫자를 쉼표(,)로 구분하여 입력"
                            className="pixel-input flex-1 text-lg"
                            disabled={!!reward || (feedback && feedback.includes('정답은'))}
                            autoFocus
                        />
                        <button type="submit" className="pixel-button px-8 py-3 text-xl whitespace-nowrap" disabled={!!reward || (feedback && feedback.includes('정답은'))}>
                            공격! (제출)
                        </button>
                    </form>
                </div>
            </div>

            <div className="w-full md:w-80 pixel-box p-4 bg-blue-950 flex flex-col">
                <h3 className="text-xl text-yellow-300 text-center mb-4 border-b-2 border-white pb-2">🏆 실시간 랭킹</h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {visiblePlayers.map((p, i) => {
                        const globalRank = players.findIndex(x => x.id === p.id) + 1;
                        const isMe = p.id === user.uid;
                        return (
                            <div key={p.id} className={`flex justify-between items-center p-2 border-2 ${isMe ? 'border-yellow-300 bg-yellow-900 bg-opacity-30' : 'border-transparent'}`}>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-gray-400 w-6">{globalRank}.</span>
                                    <span className="truncate">{p.name}</span>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-green-400 text-sm">Lv.{p.level}</div>
                                    <div className="text-xs text-gray-400">{p.xp}XP</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <RewardModal reward={reward} onClose={handleNext} />
        </div>
    );
};

const TeacherDashboard = ({ players, gameState, setGameStateLocally }) => {
    const handleEndGame = async () => {
        if(confirm("정말로 게임을 종료하시겠습니까? 모든 학생의 화면이 결과창으로 넘어갑니다.")) {
            try {
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'current'), {
                    status: 'ended'
                });
                setGameStateLocally('ended');
            } catch(e) {
                alert("종료 처리 중 오류가 발생했습니다.");
            }
        }
    };

    const handleRestart = async () => {
         if(confirm("게임을 다시 시작하시겠습니까? 학생들의 점수는 초기화되지 않습니다.")) {
            try {
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'current'), {
                    status: 'playing'
                });
                setGameStateLocally('playing');
            } catch(e) {
                alert("재시작 처리 중 오류가 발생했습니다.");
            }
        }
    };

    return (
        <div className="min-h-screen p-8 flex flex-col items-center bg-black z-10 relative">
            <div className="pixel-box p-8 max-w-4xl w-full">
                <div className="flex justify-between items-center mb-8 border-b-4 border-white pb-4">
                    <h1 className="text-3xl text-yellow-300">👨‍🏫 교사 대시보드</h1>
                    <div className="space-x-4">
                        {gameState === 'playing' ? (
                            <button onClick={handleEndGame} className="pixel-button px-6 py-2">게임 강제 종료</button>
                        ) : (
                            <button onClick={handleRestart} className="pixel-button px-6 py-2 bg-green-700">게임 재시작</button>
                        )}
                        <button onClick={() => window.location.reload()} className="pixel-button px-6 py-2 bg-gray-700">나가기</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black border-2 border-gray-600 p-4 h-96 overflow-y-auto">
                        <h2 className="text-xl mb-4 text-green-400 sticky top-0 bg-black pb-2 border-b border-gray-700">전체 학생 명단 ({players.length}명)</h2>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-gray-400">
                                    <th className="pb-2">순위</th>
                                    <th className="pb-2">이름</th>
                                    <th className="pb-2">레벨</th>
                                    <th className="pb-2">경험치</th>
                                </tr>
                            </thead>
                            <tbody>
                                {players.map((p, i) => (
                                    <tr key={p.id} className="border-t border-gray-800">
                                        <td className="py-2">{i + 1}</td>
                                        <td className="py-2 text-yellow-100">{p.name}</td>
                                        <td className="py-2 text-green-300">Lv.{p.level}</td>
                                        <td className="py-2">{p.xp}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="flex flex-col gap-4">
                        <div className="bg-black border-2 border-gray-600 p-4">
                            <h3 className="text-lg text-yellow-300 mb-2">현재 상태</h3>
                            <p className="text-2xl">{gameState === 'playing' ? '🟢 진행 중' : '🔴 종료됨'}</p>
                        </div>
                        <div className="bg-black border-2 border-gray-600 p-4 flex-1">
                            <h3 className="text-lg text-yellow-300 mb-2">접속 안내</h3>
                            <p className="text-sm text-gray-400 mb-4">학생들에게 이 주소를 공유하세요.</p>
                            <p className="break-all bg-gray-900 p-2 text-sm">{window.location.href}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState(null);
    const [nameInput, setNameInput] = useState('');
    const [players, setPlayers] = useState([]);
    const [gameState, setGameState] = useState('playing'); // playing, ended
    const [mode, setMode] = useState('login'); // login, game, teacher

    // Style Injection
    useEffect(() => {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = globalStyles;
        document.head.appendChild(styleSheet);
        return () => styleSheet.remove();
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Auth error:", error);
            }
        };
        initAuth();
        
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;

        const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
        const unsubPlayers = onSnapshot(playersRef, (snapshot) => {
            const loadedPlayers = [];
            snapshot.forEach(doc => {
                loadedPlayers.push({ id: doc.id, ...doc.data() });
            });
            loadedPlayers.sort((a, b) => b.xp - a.xp);
            setPlayers(loadedPlayers);
        }, (error) => console.error("Players listener error:", error));

        const stateRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'current');
        const unsubState = onSnapshot(stateRef, (docSnap) => {
            if (docSnap.exists()) {
                setGameState(docSnap.data().status || 'playing');
            } else {
                setDoc(stateRef, { status: 'playing' });
            }
        }, (error) => console.error("State listener error:", error));

        return () => {
            unsubPlayers();
            unsubState();
        };
    }, [user]);

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!nameInput.trim() || !user) return;

        try {
            const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid);
            const docSnap = await getDoc(playerRef);
            
            if (!docSnap.exists()) {
                await setDoc(playerRef, {
                    name: nameInput.trim(),
                    xp: 0,
                    level: 1,
                    joinedAt: Date.now()
                });
            } else {
                await updateDoc(playerRef, { name: nameInput.trim() });
            }
            setMode('game');
        } catch (error) {
            console.error("Join error:", error);
            alert("입장에 실패했습니다.");
        }
    };

    const handleTeacherLogin = () => {
        const pass = prompt("교사 비밀번호를 입력하세요 (기본값: 1234)");
        if (pass === "1234") {
            setMode('teacher');
        } else if (pass !== null) {
            alert("비밀번호가 틀렸습니다.");
        }
    };

    if (!user) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center text-xl">서버에 접속 중...</div>;
    }

    return (
        <div className="bg-black min-h-screen text-white">
            <div className="scanlines"></div>
            
            {mode === 'teacher' && (
                <TeacherDashboard players={players} gameState={gameState} setGameStateLocally={setGameState} />
            )}

            {mode === 'game' && (
                <GameScreen user={user} players={players} gameState={gameState} />
            )}

            {mode === 'login' && (
                <div className="min-h-screen flex items-center justify-center p-4 z-10 relative">
                    <div className="pixel-box p-8 max-w-md w-full text-center relative">
                        <button onClick={handleTeacherLogin} className="absolute top-2 right-2 text-xs text-gray-500 hover:text-white underline z-20 cursor-pointer">교사 모드</button>
                        
                        <h1 className="text-3xl text-yellow-300 mb-2 mt-4 leading-relaxed">수학 마스터리<br/>챌린지</h1>
                        <p className="text-green-400 mb-8 text-sm">- 분수의 덧셈과 뺄셈 편 -</p>
                        
                        <div className="text-6xl mb-6">⚔️</div>
                        
                        <form onSubmit={handleJoin} className="flex flex-col gap-4">
                            <input 
                                type="text" 
                                value={nameInput} 
                                onChange={(e) => setNameInput(e.target.value)} 
                                placeholder="도전자의 이름을 입력하라" 
                                className="pixel-input text-center text-xl py-3"
                                maxLength={10}
                                required
                            />
                            <button type="submit" className="pixel-button py-4 text-xl mt-4">게임 시작</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
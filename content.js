/* ============================================================
   MTC APP CONTENT  -  the file you edit most.
   ------------------------------------------------------------
   Text goes between "quotes". For a quote mark inside the text
   use the curly ’ instead of ' or ".
   - Add a video: paste the YouTube link after  video:
   - Add a lesson: copy one { ... }, block inside a module.
   - Add a result: see  results:  near the bottom.
   ============================================================ */

window.MTC = {
  appName: "MTC",
  coach: "Bendix Schroeder",
  photo: "bendix.jpg",
  substack: "https://bendixschroeder.substack.com/",
  instagram: "https://instagram.com/bendix.schroeder",

  /* ---------- Onboarding ---------- */
  levels: [
    "Junior, aiming for college tennis",
    "Incoming college player",
    "College player"
  ],
  goalOptions: [
    "Stay present, one point at a time",
    "Bounce back after mistakes",
    "Play the same in matches as in practice",
    "Handle nerves on big points",
    "Close out matches when I’m leading",
    "Play with more confidence",
    "Practice with more purpose"
  ],

  /* ---------- Roadmap ---------- */
  rules: [
    ["Every day, 2 minutes", "Write your journal entry right after practice or a match, while it’s fresh."],
    ["Every week, 10 minutes", "Look at your week, write what you learned and set your goals for the next one."],
    ["Before every practice", "Read your player identity once. In the car, on the bench, wherever. It takes one minute."]
  ],

  /* Past results shown on the roadmap. Leave empty until you have real ones,
     the section stays hidden. Format:
     { name: "Player, 19, D2", line: "Present-moment rating went from 6 to 8 in five weeks." } */
  results: [],

  /* ---------- Foundation ---------- */
  identity: {
    intro: "Your player identity is the player you decide to be, written down. Your brain steers you toward the picture you keep of yourself, so make it a good one. Write it in third person, like a coach describing a player he believes in.",
    prompts: [
      "How does he/she prepare before practice and matches?",
      "What does he/she do after a mistake?",
      "How does he/she act between points?",
      "How does he/she treat teammates and opponents?",
      "What does he/she believe about themselves, even when the score is bad?"
    ],
    example: "Bendix is well prepared and organized. He leaves nothing out that is in his control: grips, towel, water, snacks. He takes ownership of everything on the court and never looks for excuses, he looks for solutions. Bendix is resilient and never gives up until the last point is played, no matter if he is down or up. He takes his time and doesn’t rush, point for point. He brings energy, shares it, and cheers after every point he wins. Bendix believes in himself and even more in the potential of his team."
  },
  leading: {
    intro: "Most players lose focus when they are winning. Decide now what you will tell yourself when you are up, so you don’t have to figure it out in the moment. Short sentences work best.",
    examples: [
      "The job isn’t done until the last point is played.",
      "Keep doing what is working and play free.",
      "Play into my strengths and never slow down.",
      "Don’t give them any room to breathe."
    ]
  },

  /* ---------- Journal ---------- */
  journal: {
    focus: "Staying in the present moment",
    presentScale: [
      [10, "Every point was its own point. Even on big points I only thought about the point in front of me."],
      [8,  "Present almost the whole time. I drifted once or twice but reset before the next point."],
      [6,  "Mostly present, but on a few big points I thought about the score or what happens if I win or lose."],
      [5,  "On about half of the big points I drifted into the score, the future, or the last point."],
      [3,  "Often thinking about the score, the result, or my mistakes, and it was hard to get back."],
      [1,  "Rarely present. Most of the time I was in my head about winning or losing."],
      [0,  "Not present at all. The whole time I was in the past or the future."]
    ],
    purposeScale: [
      [10, "I knew what I was working on the whole session and did it with full intention. I can name something that improved."],
      [8,  "Intentional almost all session. I drifted once or twice, but I can name something that got better."],
      [6,  "Intentional most of the time, but there were stretches where I was just hitting balls."],
      [5,  "About half the session was purposeful and half was going through the motions."],
      [3,  "Mostly going through the motions. I didn’t really know what I was improving."],
      [0,  "I just showed up and hit. Nothing got better."]
    ],
    questions: [
      "What helped me stay present?",
      "When did I lose focus, and what was I thinking right then?",
      "How did I get back into the present moment?"
    ],
    weeklyQuestions: [
      "What worked this week? Where did I stay present the best?",
      "What got in my way? What pattern do I see?",
      "What is one thing I will do differently next week?"
    ]
  },

  /* ---------- Classroom ---------- */
  modules: [
    {
      title: "Start here",
      lessons: [
        { title: "How to use this app", video: "", minutes: 3,
          summary: "The three habits that make this work: a short journal every day, a weekly reflection, and your player identity before practice.",
          todo: "Finish your roadmap. Start with your player identity.", link: ["Open your roadmap", "#roadmap"] },
        { title: "Why the mental game is trainable", video: "", minutes: 5,
          summary: "You already train your forehand for hours. Your head works the same way: small reps, done often, with feedback.",
          todo: "Write down one moment from your last match where your head got in the way." }
      ]
    },
    {
      title: "Build your foundation",
      lessons: [
        { title: "Your self-image is a thermostat", video: "", minutes: 8,
          summary: "You play to the picture you hold of yourself, the same way a thermostat holds a room at the temperature it’s set to. Change the setting and the results follow.",
          todo: "Write your player identity in third person.", link: ["Write it now", "#foundation/identity"] },
        { title: "Your player identity, step by step", video: "", minutes: 6,
          summary: "How to write it, what to put in, and how to read it before practice so it sticks.",
          todo: "Read your identity once before your next practice.", link: ["Open your identity", "#foundation/identity"] },
        { title: "What to tell yourself when you’re leading", video: "", minutes: 6,
          summary: "Winning is when most players drift. Decide your words ahead of time.",
          todo: "Write three sentences you will tell yourself when you’re up.", link: ["Write them now", "#foundation/leading"] }
      ]
    },
    {
      title: "Stay in the present",
      lessons: [
        { title: "One point at a time", video: "", minutes: 5,
          summary: "Every point is its own point. How to stop carrying the last one, or the score, into the next.",
          todo: "In your next practice, rate yourself 0 to 10 for staying present and write one sentence about why." },
        { title: "The 20-second reset", video: "", minutes: 5,
          summary: "A short routine between points that clears the last point and sets up the next one.",
          todo: "Pick one reset and use it after every long point." },
        { title: "Bounce back after a mistake", video: "", minutes: 5,
          summary: "What to do in the five seconds after you miss, so one miss stays one miss.",
          todo: "Choose your cue word and say it after your next unforced error." }
      ]
    }
  ],

  routines: [
    { title: "The towel reset", when: "After a long or important point",
      steps: ["Walk to your towel, even if you’re not sweating.", "Walk past the fence and take three slow breaths.", "Say your cue word, then walk back to the line for the next point."] },
    { title: "Five bounces before every serve", when: "Before every first and second serve",
      steps: ["Bounce the ball exactly five times.", "On the last bounce, pick your target.", "Serve. Same routine on big points and small points."] },
    { title: "Flip the script", when: "When you face a player you think is better",
      steps: ["Notice the old thought: “They’re better than me. Why even try?”", "Swap it: “They’re better than me. This is my chance to show what I can do.”", "Play the next point with that sentence in your head."] }
  ],

  /* ---------- Community ---------- */
  community: {
    invite: "https://discord.gg/HkwhBhWC7E",
    intro: "This is where players who take the mental side seriously hang out. Ask me anything, share how your last match went, and learn from players who deal with the same nerves you do.",
    channels: [
      ["introduce-yourself", "Say hi. Who you are, where you play, and what you want to get better at."],
      ["general", "Everything tennis and the mental game. Match days, tournaments, questions, whatever is on your mind."],
      ["ask-bendix", "Questions about the mental game. I answer every one."],
      ["wins", "A big point you closed out, a routine that clicked, a match you turned around."]
    ],
    rules: [
      "Be the teammate you’d want. Encourage, don’t judge.",
      "No selling, spam or self-promotion.",
      "Keep personal info private. Never share your address, phone number or school schedule.",
      "Discord is 13+. If you’re under 18, keep chats in the public channels."
    ]
  }
};

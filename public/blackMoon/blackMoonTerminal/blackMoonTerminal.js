const terminal = document.getElementById("terminal");

const script = [
  {
    type: "auto",
    text: `> 警告：本数据库仅限具基金会4级及以上权限者访问。\n> 部分档案可能需要5级或6级权限访问。\n> 不具有相应权限者请勿访问。\n> 违者将面临基金会的定位及处罚措施。\n\n`
  },
  {
    type: "auto",
    text: `> 请输入指令。\n\n`
  },
  {
    type: "input",
    prompt: `> login: `,
    answer: `O5-11`
  },
  {
    type: "auto",
    text: `\n> 警告：\n> 你即将以O5-11身份登入数据库。\n> 本ID为基金会6级权限职员持有。\n> 未授权访问将被立即处决。\n\n`
  },
  {
    type: "auto",
    text: `> 请验证指令：黑月是否嚎叫？\n\n`
  },
  {
    type: "input",
    prompt: `> `,
    answer: `怒号无人确晓`
  },
  {
    type: "auto",
    text: `\n> 验证问题通过。\n> 正在进行生物计量学检测……\n> 生物计量学检测通过。\n> 欢迎回来，O5-11。\n\n`
  },
  {
    type: "input",
    prompt: `> search all-database mark"`,
    answer: `B3EC4VEM"`
  },
  {
    type: "auto",
    text: `
> 正在SCiPNET-INT全分部数据库中查询指定关键词……
> 在 总部数据库 中找到 1 个结果：错误：(null)
> 在 俄罗斯分部数据库 中找到 1 个结果：错误：(null)
> 在 德国分部数据库 中找到 1 个结果：错误：(null)
> 在 法国分部数据库 中找到 1 个结果：错误：(null)
> 在 日本分部数据库 中找到 1 个结果：错误：(null)
> 在 中国分部数据库 中找到 1 个结果：SCP-CN-2000
> 是否访问该文档（Y/N）？
\n`
  },
  {
    type: "input",
    prompt: `> `,
    answer: `Y`
  },
  {
    type: "auto",
    text: `\n> 权限验证通过。\n> 正在为您加载文档中……\n`
  }
];

let index = 0;
let charIndex = 0;
let inputMode = false;
let currentAnswer = "";
let waitingForEnter = false;

function typeAuto(text, cb) {
  let i = 0;
  const timer = setInterval(() => {
    terminal.textContent += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(timer);
      cb();
    }
    window.scrollTo(0, document.body.scrollHeight);
  }, 25);
}

function next() {
  if (index >= script.length) {
    setTimeout(() => {
      window.location.href = "../blackMoonText/blackMoonText.html";
    }, 1000);
    return;
  }

  const item = script[index];

  if (item.type === "auto") {
    typeAuto(item.text, () => {
      index++;
      next();
    });
  } else {
    inputMode = true;
    currentAnswer = item.answer;
    charIndex = 0;
    waitingForEnter = false;
    terminal.textContent += item.prompt;
  }
}

document.addEventListener("keydown", (e) => {
  if (!inputMode) return;

  e.preventDefault();

  if (charIndex < currentAnswer.length) {
    terminal.textContent += currentAnswer[charIndex];
    charIndex++;
  } else {
    if (e.key === "Enter") {
      terminal.textContent += "\n";
      inputMode = false;
      index++;
      next();
    }
  }

  window.scrollTo(0, document.body.scrollHeight);
});

next();

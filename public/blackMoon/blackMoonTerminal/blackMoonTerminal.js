const terminal = document.getElementById("terminal");

const script = [
  {
    type: "auto",
    text: `> 警告：本数据库仅对持有 理事会 A 级权限及以上 的成员开放。\n> 部分档案被标记为 S 级权限。\n> 访问前需完成额外的身份与认知一致性验证。\n\n `
  },
  {
    type: "auto",
    text: `> 非授权人员请勿尝试访问。\n> 任何越权行为都将触发 理事会定位程序 与 纪律处置流程。\n\n`
  },
  {
    type: "auto",
    text: `> 接入节点：\n> CHINA Branch: Information Analysis & Cryptography\n> 加密通信链路：CiSecNET-INT / CN-Primary\n\n`
  },
  {
    type: "auto",
    text: `> 请输入访问指令。\n\n`
  },
  {
    type: "input",
    prompt: `> login: `,
    answer: `NULL`
  },
  {
    type: "auto",
    text: `\n> 警告：你正尝试以身份标识 NULL 登录系统。\n> 该身份为 理事会 S 级授权席位，其权限覆盖全域档案、最终封存区与紧急处置协议。\n\n`
  },
  {
    type: "auto",
    text: `> 未授权访问将被视为最高级安全事件。\n> 系统将立即执行终止流程，无需人工复核。\n\n`
  },
  {
    type: "auto",
    text: `> 请验证指令：君无上天些？\n\n`
  },
  {
    type: "input",
    prompt: `> `,
    answer: `月黑鬼车来`
  },
  {
    type: "auto",
    text: `\n> 语义一致性校验通过。\n> 历史应答偏移：0.00%\n\n`
  },
  {
    type: "auto",
    text: `> 正在执行生物识别扫描......\n\n`
  },
    {
    type: "auto",
    text: `\n> 权限验证通过。\n> 正在为您加载文档中......\n> 欢迎回来，NULL。\n\n`
  },
  {
    type: "input",
    prompt: `> 查询指令: search all-database mark `,
    answer: ` ̤͉̚I​͇͇̐L​̢̝̐I​̠̯̌E​͉́̅S​̶̳͢P​̻̎̐C​̨̪̎S​̦͎̣  `
  },
  {
    type: "auto",
    text: `\n> 正在 CiSecNET-INT 全球分支数据库中检索指定关键词......
> 总部数据库 (Geneva): 发现 1 个结果 —— [DATA LOSS / UNREADABLE DATA]
> 俄罗斯分部 (Siberia): 发现 1 个结果 —— [LOCKED by AGREEMENT 09]
> 德国分部 (Berlin): 发现 1 个结果 —— [LOGICAL DEADLOCK]
> 法国分部 (Paris): 发现 1 个结果 —— [PRIVILEGE OVERFLOW]
> 日本分部 (Kyoto): 发现 1 个结果 —— [ARCHIVED UNDER the "忌名" AGREEMENT]
> 中国分部 (BeiJing): 发现 1 个结果 —— 项目代号：ECLIPSIS
> 是否访问该文档（Y/N）？\n\n`
  },
  /*忌名加个日式字体*/
  {
    type: "input",
    prompt: `> `,
    answer: `Y`
  },
  {
    type: "auto",
    text: `\n> 权限验证通过。\n> 正在为您加载文档中......\n`
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

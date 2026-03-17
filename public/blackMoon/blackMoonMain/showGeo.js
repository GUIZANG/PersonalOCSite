const container = document.getElementById("geoHover");
const geoBtn = document.getElementById("geoBtn");

let hoverTimer = null;

container.addEventListener("mouseenter", () => {
  hoverTimer = setTimeout(() => {
    container.classList.add("show-geo");
  }, 500);
});

container.addEventListener("mouseleave", () => {
  clearTimeout(hoverTimer);
  hoverTimer = null;
  container.classList.remove("show-geo");
});

// 点击才真正请求位置权限
geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("浏览器不支持定位");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      console.log("lat:", pos.coords.latitude);
      console.log("lng:", pos.coords.longitude);
    },
    (err) => {
      console.warn("定位失败:", err.message);
    }
  );
});

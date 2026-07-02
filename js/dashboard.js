const STORAGE_KEY = "saeedStoreData";
const clone = (value) => JSON.parse(JSON.stringify(value));
const today = () => new Date().toISOString().slice(0, 10);
const slug = (value) => String(value || "").trim().toLowerCase().replace(/[^\w\u0600-\u06ff]+/g, "-").replace(/^-|-$/g, "") || `item-${Date.now()}`;
const ICONS = "🛍️ 🛒 🎁 🔥 ⭐ 💎 🏷️ ⌚ 📱 🎧 💻 🖥️ ⌨️ 🖱️ 📷 🎮 🔌 🔋 💡 🧢 👟 👕 👗 👔 👜 🎒 👓 🕶️ 💍 📿 🧴 🧸 🏠 🛏️ 🪑 🍽️ ☕ 🍫 🧃 🍔 🍕 🚗 🏍️ 🚲 ⚽ 🏀 🏆 📚 ✏️ 🧰 🔧 🪛 🧲 🧪 💊 🩺 🌿 🌹 🎨 🖼️ 🎵 🎤 📦 🚚 ✅ ❌ ⏳ 💬 📞 📧 📍 🌐".split(" ");

function loadStore() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return clone(window.SAEED_DEFAULT_DATA);
  try {
    return { ...clone(window.SAEED_DEFAULT_DATA), ...JSON.parse(saved) };
  } catch {
    return clone(window.SAEED_DEFAULT_DATA);
  }
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.SAEED_FIREBASE?.save(store).catch((error) => console.error("Firebase save failed", error));
}

function addChange(text) {
  store.changes = store.changes || [];
  store.changes.unshift(`${today()} - ${text}`);
  store.changes = store.changes.slice(0, 12);
}

let store = loadStore();
let mediaDraft = null;

function applySettingsColors() {
  const s = store.settings;
  document.documentElement.style.setProperty("--primary", s.primaryColor || "#2563EB");
  document.documentElement.style.setProperty("--secondary", s.secondaryColor || "#10B981");
  document.documentElement.style.setProperty("--button", s.buttonColor || "#F97316");
  document.documentElement.style.setProperty("--bg", s.backgroundColor || "#F8FAFC");
  document.documentElement.style.setProperty("--text", s.textColor || "#1F2937");
  document.documentElement.style.setProperty("--font", s.fontFamily || "Tahoma, Arial, sans-serif");
}

function categoryName(id) {
  return store.categories.find((cat) => cat.id === id)?.name || "بدون قسم";
}

function renderOverview() {
  const low = store.products.filter((p) => p.stock > 0 && p.stock <= 5);
  const out = store.products.filter((p) => p.stock <= 0);
  document.getElementById("statsGrid").innerHTML = [
    ["عدد المنتجات", store.products.length],
    ["عدد الأقسام", store.categories.length],
    ["عدد الزيارات", store.visits || 0],
    ["منتجات قاربت على النفاد", low.length + out.length]
  ].map(([label, value]) => `<div class="stat-card"><strong>${value}</strong><span>${label}</span></div>`).join("");
  document.getElementById("stockAlerts").innerHTML = [...out, ...low].map((p) => `<div class="alert-item"><strong>${p.name}</strong><br>الكمية الحالية: ${p.stock} - ${p.stock <= 0 ? "غير متوفر" : "قارب على النفاد"}</div>`).join("") || "<p>لا توجد تنبيهات مخزون.</p>";
  document.getElementById("recentChanges").innerHTML = (store.changes || []).map((c) => `<div class="alert-item">${c}</div>`).join("") || "<p>لا توجد تعديلات بعد.</p>";
}

function productRow(product) {
  return `
    <div class="admin-row">
      <img src="${product.image || "assets/hero-store.svg"}" alt="${product.name}">
      <div>
        <strong>${product.name}</strong>
        <div>${product.price} جنيه - ${categoryName(product.category)} - كمية ${product.stock}</div>
        <small>${product.visible === false ? "مخفي" : product.stock <= 0 ? "غير متوفر" : "ظاهر"}</small>
      </div>
      <div class="row-actions">
        <button type="button" data-edit-product="${product.id}">تعديل</button>
        <button type="button" data-toggle-product="${product.id}">${product.visible === false ? "إظهار" : "إخفاء"}</button>
        <button type="button" data-stock-plus="${product.id}">+ كمية</button>
        <button type="button" data-stock-minus="${product.id}">- كمية</button>
        <button type="button" class="danger" data-delete-product="${product.id}">حذف</button>
      </div>
    </div>
  `;
}

function renderProductsAdmin() {
  document.querySelector('[name="category"]').innerHTML = store.categories.map((cat) => `<option value="${cat.id}">${cat.name}</option>`).join("");
  document.getElementById("adminProducts").innerHTML = store.products.sort((a, b) => Number(a.order || 999) - Number(b.order || 999)).map(productRow).join("");
  bindProductRows();
}

function bindProductRows() {
  document.querySelectorAll("[data-edit-product]").forEach((button) => button.addEventListener("click", () => fillProductForm(button.dataset.editProduct)));
  document.querySelectorAll("[data-toggle-product]").forEach((button) => button.addEventListener("click", () => {
    const product = store.products.find((p) => p.id === button.dataset.toggleProduct);
    product.visible = product.visible === false;
    addChange(`تم ${product.visible ? "إظهار" : "إخفاء"} المنتج ${product.name}`);
    saveAndRender();
  }));
  document.querySelectorAll("[data-stock-plus]").forEach((button) => button.addEventListener("click", () => changeStock(button.dataset.stockPlus, 1)));
  document.querySelectorAll("[data-stock-minus]").forEach((button) => button.addEventListener("click", () => changeStock(button.dataset.stockMinus, -1)));
  document.querySelectorAll("[data-delete-product]").forEach((button) => button.addEventListener("click", () => {
    const product = store.products.find((p) => p.id === button.dataset.deleteProduct);
    store.products = store.products.filter((p) => p.id !== button.dataset.deleteProduct);
    addChange(`تم حذف المنتج ${product?.name || ""}`);
    saveAndRender();
  }));
}

function changeStock(id, diff) {
  const product = store.products.find((p) => p.id === id);
  product.stock = Math.max(0, Number(product.stock || 0) + diff);
  if (product.stock === 0) product.visible = product.visible !== false;
  product.updatedAt = today();
  addChange(`تم تعديل كمية ${product.name} إلى ${product.stock}`);
  saveAndRender();
}

function fillProductForm(id) {
  const product = store.products.find((p) => p.id === id);
  const form = document.getElementById("productForm");
  Object.entries(product).forEach(([key, value]) => {
    if (!form.elements[key]) return;
    if (key === "gallery") {
      setGalleryField(form, value);
      return;
    }
    if (form.elements[key].type === "checkbox") form.elements[key].checked = Boolean(value);
    else form.elements[key].value = Array.isArray(value) ? value.join(", ") : value ?? "";
  });
  updateImagePreviews();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function productFromForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    id: data.id || slug(data.name),
    name: data.name,
    price: Number(data.price || 0),
    oldPrice: Number(data.oldPrice || 0),
    category: data.category,
    brand: data.brand,
    color: data.color,
    size: data.size,
    specs: data.specs,
    description: data.description,
    image: data.image || "assets/hero-store.svg",
    gallery: parseGalleryValue(data.gallery),
    rating: Number(data.rating || 5),
    stock: Number(data.stock || 0),
    featured: form.elements.featured.checked,
    visible: form.elements.visible.checked,
    order: Number(data.order || store.products.length + 1),
    updatedAt: today()
  };
}

function renderCategoriesAdmin() {
  document.getElementById("adminCategories").innerHTML = store.categories.sort((a, b) => Number(a.order || 999) - Number(b.order || 999)).map((cat) => `
    <div class="admin-row">
      <img src="${cat.image || "assets/hero-store.svg"}" alt="${cat.name}">
      <div><strong>${cat.icon || ""} ${cat.name}</strong><div>ترتيب ${cat.order || "-"}</div></div>
      <div class="row-actions">
        <button type="button" data-edit-category="${cat.id}">تعديل</button>
        <button type="button" class="danger" data-delete-category="${cat.id}">حذف</button>
      </div>
    </div>
  `).join("");
  document.querySelectorAll("[data-edit-category]").forEach((button) => button.addEventListener("click", () => fillCategoryForm(button.dataset.editCategory)));
  document.querySelectorAll("[data-delete-category]").forEach((button) => button.addEventListener("click", () => {
    const used = store.products.some((p) => p.category === button.dataset.deleteCategory);
    if (used) {
      alert("لا يمكن حذف قسم مستخدم في منتجات. غيّر قسم المنتجات أولا.");
      return;
    }
    const cat = store.categories.find((c) => c.id === button.dataset.deleteCategory);
    store.categories = store.categories.filter((c) => c.id !== button.dataset.deleteCategory);
    addChange(`تم حذف القسم ${cat?.name || ""}`);
    saveAndRender();
  }));
}

function fillCategoryForm(id) {
  const cat = store.categories.find((item) => item.id === id);
  const form = document.getElementById("categoryForm");
  Object.entries(cat).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
  updateImagePreviews();
  markSelectedIcon();
}

function renderForms() {
  fillObjectForm("bannerForm", store.banner);
  fillObjectForm("contactForm", store.contact);
  fillObjectForm("settingsForm", store.settings);
  renderMediaManager();
}

function fillObjectForm(formId, object) {
  const form = document.getElementById(formId);
  Object.entries(object).forEach(([key, value]) => {
    if (!form.elements[key]) return;
    if (form.elements[key].type === "checkbox") form.elements[key].checked = Boolean(value);
    else form.elements[key].value = value ?? "";
  });
  updateImagePreviews();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function imageValueFromFile(file) {
  const source = await readFileAsDataUrl(file);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 900;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => resolve(source);
    image.src = source;
  });
}

function parseGalleryValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    return text.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function setGalleryField(form, gallery) {
  form.elements.gallery.value = JSON.stringify(parseGalleryValue(gallery));
}

function updateImagePreviews() {
  document.querySelectorAll("[data-image-target]").forEach((input) => {
    const preview = document.getElementById(input.dataset.imageTarget);
    if (preview) preview.src = input.value || "assets/hero-store.svg";
  });
  const galleryField = document.getElementById("productForm").elements.gallery;
  const gallery = parseGalleryValue(galleryField.value);
  document.getElementById("productGalleryPreview").innerHTML = gallery.map((src) => `<img src="${src}" alt="صورة معرض">`).join("");
}

function escapeAttr(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function mediaItems() {
  const items = [
    { key: "banner:image", title: "صورة بداية الموقع / البانر الرئيسي", value: store.banner.image || "assets/hero-store.svg" }
  ];
  store.categories.sort((a, b) => Number(a.order || 999) - Number(b.order || 999)).forEach((category) => {
    items.push({ key: `category:${category.id}:image`, title: `صورة قسم ${category.icon || ""} ${category.name}`, value: category.image || "assets/hero-store.svg" });
  });
  store.products.sort((a, b) => Number(a.order || 999) - Number(b.order || 999)).forEach((product) => {
    items.push({ key: `product:${product.id}:image`, title: `الصورة الرئيسية للمنتج ${product.name}`, value: product.image || "assets/hero-store.svg" });
    parseGalleryValue(product.gallery).forEach((src, index) => {
      items.push({ key: `product:${product.id}:gallery:${index}`, title: `صورة معرض ${index + 1} - ${product.name}`, value: src || "assets/hero-store.svg" });
    });
  });
  return items;
}

function renderMediaManager() {
  const manager = document.getElementById("mediaManager");
  if (!manager) return;
  const items = mediaItems();
  if (!mediaDraft) mediaDraft = Object.fromEntries(items.map((item) => [item.key, item.value]));
  manager.innerHTML = items.map((item) => {
    const value = mediaDraft[item.key] || item.value || "assets/hero-store.svg";
    return `
      <div class="media-row" data-media-row="${item.key}">
        <img src="${value}" alt="${item.title}">
        <div class="media-fields">
          <h3>${item.title}</h3>
          <input type="hidden" value="${escapeAttr(value)}" data-media-key="${item.key}">
          <div class="media-actions">
            <label class="secondary-button">تحميل صورة من الجهاز<input type="file" accept="image/*" data-media-upload="${item.key}" hidden></label>
            <button class="text-button" type="button" data-media-clear="${item.key}">استخدام الصورة الافتراضية</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
  bindMediaManagerRows();
}

function setMediaDirty(isDirty = true) {
  const hint = document.querySelector("#tab-media .save-hint");
  if (!hint) return;
  hint.classList.toggle("dirty", isDirty);
  hint.textContent = isDirty ? "يوجد تعديلات غير محفوظة. اضغط حفظ التعديلات حتى تظهر في الموقع." : "تم حفظ التعديلات. يمكنك تعديل صور أخرى عند الحاجة.";
}

function bindMediaManagerRows() {
  document.querySelectorAll("[data-media-key]").forEach((input) => {
    input.addEventListener("input", () => {
      mediaDraft[input.dataset.mediaKey] = input.value;
      const row = input.closest(".media-row");
      row.querySelector("img").src = input.value || "assets/hero-store.svg";
      setMediaDirty(true);
    });
  });
  document.querySelectorAll("[data-media-upload]").forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const dataUrl = await imageValueFromFile(file, "media");
      const key = input.dataset.mediaUpload;
      mediaDraft[key] = dataUrl;
      const row = input.closest(".media-row");
      row.querySelector("img").src = dataUrl;
      row.querySelector("[data-media-key]").value = dataUrl;
      input.value = "";
      setMediaDirty(true);
    });
  });
  document.querySelectorAll("[data-media-clear]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.mediaClear;
      mediaDraft[key] = "assets/hero-store.svg";
      const row = button.closest(".media-row");
      row.querySelector("img").src = mediaDraft[key];
      row.querySelector("[data-media-key]").value = mediaDraft[key];
      setMediaDirty(true);
    });
  });
}

function applyMediaChanges() {
  Object.entries(mediaDraft || {}).forEach(([key, value]) => {
    const parts = key.split(":");
    if (parts[0] === "banner") {
      store.banner.image = value || "assets/hero-store.svg";
      return;
    }
    if (parts[0] === "category") {
      const category = store.categories.find((item) => item.id === parts[1]);
      if (category) category.image = value || "assets/hero-store.svg";
      return;
    }
    if (parts[0] === "product") {
      const product = store.products.find((item) => item.id === parts[1]);
      if (!product) return;
      if (parts[2] === "image") product.image = value || "assets/hero-store.svg";
      if (parts[2] === "gallery") {
        product.gallery = product.gallery || [];
        product.gallery[Number(parts[3])] = value || "assets/hero-store.svg";
      }
      product.updatedAt = today();
    }
  });
  addChange("تم حفظ تعديلات الصور والمحتوى");
  mediaDraft = null;
  saveAndRender();
  setMediaDirty(false);
}

function bindUploads() {
  document.querySelectorAll("[data-upload-to]").forEach((input) => {
    input.addEventListener("change", async () => {
      const [formId, fieldName] = input.dataset.uploadTo.split(":");
      const file = input.files?.[0];
      if (!file) return;
      const dataUrl = await imageValueFromFile(file, fieldName);
      document.getElementById(formId).elements[fieldName].value = dataUrl;
      updateImagePreviews();
      input.value = "";
    });
  });
  document.querySelectorAll("[data-upload-gallery]").forEach((input) => {
    input.addEventListener("change", async () => {
      const [formId, fieldName] = input.dataset.uploadGallery.split(":");
      const files = [...(input.files || [])];
      if (!files.length) return;
      const form = document.getElementById(formId);
      const current = parseGalleryValue(form.elements[fieldName].value);
      const urls = await Promise.all(files.map((file) => imageValueFromFile(file, fieldName)));
      form.elements[fieldName].value = JSON.stringify([...current, ...urls].filter(Boolean));
      updateImagePreviews();
      input.value = "";
    });
  });
  document.querySelectorAll("[data-image-target]").forEach((input) => {
    input.addEventListener("input", updateImagePreviews);
  });
  document.getElementById("productForm").elements.gallery.addEventListener("input", updateImagePreviews);
}

function renderIconPicker() {
  const picker = document.getElementById("iconPicker");
  picker.innerHTML = ICONS.map((icon) => `<button type="button" data-icon="${icon}" title="${icon}">${icon}</button>`).join("");
  picker.querySelectorAll("[data-icon]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("categoryForm").elements.icon.value = button.dataset.icon;
      markSelectedIcon();
    });
  });
  document.getElementById("categoryForm").elements.icon.addEventListener("input", markSelectedIcon);
  markSelectedIcon();
}

function markSelectedIcon() {
  const selected = document.getElementById("categoryForm").elements.icon.value;
  document.querySelectorAll("[data-icon]").forEach((button) => {
    button.classList.toggle("active", button.dataset.icon === selected);
  });
}

function objectFromForm(form) {
  const data = {};
  [...form.elements].forEach((el) => {
    if (!el.name) return;
    data[el.name] = el.type === "checkbox" ? el.checked : el.value;
  });
  return data;
}

function bindForms() {
  document.getElementById("productForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const product = productFromForm(event.currentTarget);
    const index = store.products.findIndex((p) => p.id === product.id);
    if (index >= 0) store.products[index] = product;
    else store.products.push(product);
    addChange(`تم حفظ المنتج ${product.name}`);
    event.currentTarget.reset();
    event.currentTarget.elements.visible.checked = true;
    saveAndRender();
  });
  document.getElementById("clearProductForm").addEventListener("click", () => {
    document.getElementById("productForm").reset();
    document.getElementById("productForm").elements.visible.checked = true;
    updateImagePreviews();
  });
  document.getElementById("categoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = objectFromForm(event.currentTarget);
    const category = { id: data.id || slug(data.name), name: data.name, icon: data.icon, image: data.image || "assets/hero-store.svg", order: Number(data.order || store.categories.length + 1) };
    const index = store.categories.findIndex((cat) => cat.id === category.id);
    if (index >= 0) store.categories[index] = category;
    else store.categories.push(category);
    addChange(`تم حفظ القسم ${category.name}`);
    event.currentTarget.reset();
    saveAndRender();
  });
  document.getElementById("bannerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    store.banner = objectFromForm(event.currentTarget);
    addChange("تم تعديل البانر الرئيسي");
    saveAndRender();
  });
  document.getElementById("contactForm").addEventListener("submit", (event) => {
    event.preventDefault();
    store.contact = objectFromForm(event.currentTarget);
    addChange("تم تعديل بيانات التواصل");
    saveAndRender();
  });
  document.getElementById("settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    store.settings = objectFromForm(event.currentTarget);
    addChange("تم تعديل إعدادات الموقع");
    saveAndRender();
  });
}

function bindTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-admin-tab]").forEach((el) => el.classList.remove("active"));
      document.querySelectorAll(".admin-tab").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(`tab-${button.dataset.adminTab}`).classList.add("active");
    });
  });
}

function bindDataActions() {
  document.getElementById("saveDashboardChanges").addEventListener("click", () => {
    saveStore();
    showSaveToast("تم حفظ التعديلات بنجاح");
  });
  document.getElementById("saveMediaChanges").addEventListener("click", applyMediaChanges);
}

function showSaveToast(message) {
  const toast = document.getElementById("saveToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showSaveToast.timer);
  showSaveToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2500);
}

function bindPasswordGate() {
  const gate = document.getElementById("passwordGate");
  if (sessionStorage.getItem("saeedAdminUnlocked") === "1") {
    gate.classList.add("hidden");
  }
  document.getElementById("passwordForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const password = event.currentTarget.elements.password.value;
    if (password === (store.settings.adminPassword || "12345679987654321")) {
      sessionStorage.setItem("saeedAdminUnlocked", "1");
      gate.classList.add("hidden");
      return;
    }
    document.getElementById("passwordError").textContent = "كلمة المرور غير صحيحة";
  });
}

function saveAndRender() {
  saveStore();
  applySettingsColors();
  renderOverview();
  renderProductsAdmin();
  renderCategoriesAdmin();
  renderForms();
}

async function initializeDashboard() {
  try {
    const remote = await window.SAEED_FIREBASE?.init(window.SAEED_DEFAULT_DATA);
    if (remote?.data) {
      store = { ...clone(window.SAEED_DEFAULT_DATA), ...remote.data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  } catch (error) {
    console.error("Firebase load failed", error);
  }

  if (!store.settings.adminPassword || store.settings.adminPassword === "admin123") {
    store.settings.adminPassword = "12345679987654321";
    saveStore();
  }

  applySettingsColors();
  bindPasswordGate();
  bindTabs();
  bindForms();
  bindDataActions();
  bindUploads();
  renderIconPicker();
  saveAndRender();
}

initializeDashboard();

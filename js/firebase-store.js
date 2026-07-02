(function () {
  const STORAGE_KEY = "saeedStoreData";
  const STORE_COLLECTION = "site";
  const STORE_DOC = "store";
  let db = null;
  let enabled = false;

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function hasConfig(config) {
    return Boolean(config && config.apiKey && config.projectId && config.appId);
  }

  async function init(defaultData) {
    const config = window.SAEED_FIREBASE_CONFIG;
    if (!hasConfig(config) || !window.firebase) return { enabled: false, data: null };

    if (!window.firebase.apps.length) window.firebase.initializeApp(config);
    db = window.firebase.firestore();
    enabled = true;

    const ref = db.collection(STORE_COLLECTION).doc(STORE_DOC);
    const snap = await ref.get();
    if (snap.exists) return { enabled: true, data: snap.data() };

    const initial = clone(defaultData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    await ref.set(initial);
    return { enabled: true, data: initial };
  }

  async function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (!enabled || !db) return;
    await db.collection(STORE_COLLECTION).doc(STORE_DOC).set(clone(data));
  }

  window.SAEED_FIREBASE = {
    init,
    save,
    isEnabled: () => enabled
  };
}());

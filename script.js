const data = window.LUNAR_DATA;
const storageKey = "lunar_builder_rosters_v1";

const state = {
  view: "cards",
  catalogKind: "all",
  catalogFaction: "all",
  catalogRole: "all",
  catalogQuery: "",
  builderQuery: "",
  rulesFilter: "all",
  rulesQuery: "",
  roster: {
    name: "Lunar mission",
    faction: data.defaults.faction,
    budget: data.defaults.credits,
    units: []
  },
  saved: []
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function formatValue(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function allCatalogCards() {
  return [
    ...data.units.map((item) => ({ ...item, kind: "unit" })),
    ...data.equipment.map((item) => ({ ...item, kind: "equipment", faction: item.faction || "Neutral" }))
  ];
}

function getUnit(id) {
  return data.units.find((unit) => unit.id === id);
}

function getEquipment(id) {
  return data.equipment.find((item) => item.id === id);
}

function getFactionClass(faction) {
  return faction === "NASA" || faction === "USSR" ? faction : "Neutral";
}

function getCardTitle(card) {
  return card.kind === "equipment" ? card.name : `${card.name}`;
}

function getCardSubtitle(card) {
  if (card.kind === "equipment") {
    return `${card.rarity || "Common"} · ${card.mass} mass · ${card.credits} credits`;
  }
  return `${card.subtitle} · ${card.set}`;
}

function cardSearchText(card) {
  return normalize([
    card.name,
    card.subtitle,
    card.faction,
    card.role,
    card.set,
    card.rarity,
    card.text,
    ...(card.keywords || []),
    ...(card.traits || []),
    ...(card.attacks || [])
  ].join(" "));
}

function buildRoleOptions() {
  const roles = [...new Set(data.units.map((unit) => unit.role))].sort();
  $("catalogRole").innerHTML = [
    '<option value="all">Все роли</option>',
    ...roles.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`)
  ].join("");
}

function renderCatalog() {
  const cards = allCatalogCards().filter((card) => {
    if (state.catalogKind !== "all" && card.kind !== state.catalogKind) return false;
    if (state.catalogFaction !== "all" && card.faction !== state.catalogFaction) return false;
    if (state.catalogRole !== "all" && card.role !== state.catalogRole) return false;
    if (state.catalogQuery && !cardSearchText(card).includes(normalize(state.catalogQuery))) return false;
    return true;
  });

  $("catalogCount").textContent = cards.length;
  $("catalogGrid").innerHTML = cards.map(renderCatalogCard).join("") || `<div class="empty-state">Ничего не найдено</div>`;
}

function renderCatalogCard(card) {
  const subtitle = getCardSubtitle(card);
  const badge = card.kind === "unit"
    ? `<span class="faction-badge ${getFactionClass(card.faction)}">${escapeHtml(card.faction)}</span>`
    : `<span class="${card.rarity === "Rare" ? "rare-badge" : "type-badge"}">${escapeHtml(card.rarity || "Item")}</span>`;
  const stats = card.kind === "unit"
    ? [
        ["MOV", card.move],
        ["COMP", formatValue(card.competency)],
        ["DEF", card.defense],
        ["INT", card.integrity]
      ]
    : [
        ["MASS", card.mass],
        ["CR", card.credits],
        ["TYPE", card.type === "weapon" ? "WPN" : "ITEM"],
        ["USE", formatValue(card.uses)]
      ];
  const tags = card.kind === "unit" ? card.keywords : card.traits;
  return `
    <article class="catalog-card">
      <button class="card-hit" type="button" data-kind="${card.kind}" data-id="${escapeHtml(card.id)}">
        <div class="thumb-wrap"><img src="${escapeHtml(card.img)}" alt="${escapeHtml(getCardTitle(card))}" loading="lazy"></div>
        <div class="catalog-body">
          <div class="card-name-row">
            <div>
              <h2 class="card-title">${escapeHtml(getCardTitle(card))}</h2>
              <div class="card-subtitle">${escapeHtml(subtitle)}</div>
            </div>
            ${badge}
          </div>
          <div class="stat-row">
            ${stats.map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatValue(value))}</strong></div>`).join("")}
          </div>
          <div class="tag-row">${(tags || []).slice(0, 5).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        </div>
      </button>
    </article>
  `;
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach((element) => {
    element.classList.toggle("active", element.id === `${view}View`);
  });
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  if (view === "builder") renderBuilder();
  if (view === "rules") renderRules();
}

function showCardModal(kind, id) {
  const source = kind === "unit" ? getUnit(id) : getEquipment(id);
  if (!source) return;
  const card = { ...source, kind, faction: source.faction || "Neutral" };
  const statRows = kind === "unit"
    ? [
        ["Faction", card.faction],
        ["Role", card.role],
        ["Move", card.move],
        ["Competency", formatValue(card.competency)],
        ["Defense", card.defense],
        ["Integrity", card.integrity],
        ["Mass", card.mass],
        ["Set", card.set]
      ]
    : [
        ["Type", card.type],
        ["Rarity", card.rarity],
        ["Mass", card.mass],
        ["Credits", card.credits],
        ["Uses", formatValue(card.uses)],
        ["Faction", card.faction],
        ["Set", card.set]
      ];
  const tags = kind === "unit" ? card.keywords : card.traits;
  $("modalBody").innerHTML = `
    <img class="modal-card-image" src="${escapeHtml(card.img)}" alt="${escapeHtml(getCardTitle(card))}">
    <div class="modal-info">
      <h2 id="modalTitle">${escapeHtml(getCardTitle(card))}</h2>
      <div class="subtitle">${escapeHtml(kind === "unit" ? card.subtitle : `${card.rarity} ${card.type}`)}</div>
      <div class="detail-grid">
        ${statRows.map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatValue(value))}</strong></div>`).join("")}
      </div>
      ${(card.attacks || []).length ? `<div class="tag-row">${card.attacks.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      <p>${escapeHtml(card.text)}</p>
      <div class="tag-row">${(tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    </div>
  `;
  $("cardModal").classList.add("active");
  $("cardModal").setAttribute("aria-hidden", "false");
}

function closeCardModal() {
  $("cardModal").classList.remove("active");
  $("cardModal").setAttribute("aria-hidden", "true");
}

function makeInstanceId() {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function addUnit(unitId) {
  const unit = getUnit(unitId);
  if (!unit) return;
  state.roster.units.push({
    instanceId: makeInstanceId(),
    unitId,
    equipmentIds: []
  });
  renderBuilder();
}

function removeUnit(instanceId) {
  state.roster.units = state.roster.units.filter((entry) => entry.instanceId !== instanceId);
  renderBuilder();
}

function canEquip(unit, equipment) {
  if (!unit || !equipment) return false;
  if (equipment.faction && equipment.faction !== unit.faction) return false;
  const isRangedWeapon = equipment.type === "weapon" && (equipment.traits || []).includes("Ranged");
  if (unit.role === "Medical Specialist" && isRangedWeapon) return false;
  const isRareWeapon = equipment.type === "weapon" && equipment.rarity === "Rare";
  if (unit.role === "Tech Specialist" && isRareWeapon) return false;
  return true;
}

function availableEquipmentForUnit(unit) {
  return data.equipment.filter((item) => canEquip(unit, item));
}

function addEquipment(instanceId, equipmentId) {
  const entry = state.roster.units.find((unit) => unit.instanceId === instanceId);
  const unit = entry ? getUnit(entry.unitId) : null;
  const equipment = getEquipment(equipmentId);
  if (!entry || !canEquip(unit, equipment)) return;
  entry.equipmentIds.push(equipmentId);
  renderBuilder();
}

function removeEquipment(instanceId, index) {
  const entry = state.roster.units.find((unit) => unit.instanceId === instanceId);
  if (!entry) return;
  entry.equipmentIds.splice(index, 1);
  renderBuilder();
}

function rosterEquipment() {
  return state.roster.units.flatMap((entry) => entry.equipmentIds.map(getEquipment).filter(Boolean));
}

function rosterCreditsUsed() {
  return rosterEquipment().reduce((sum, item) => sum + Number(item.credits || 0), 0);
}

function rosterItemMass() {
  return rosterEquipment().reduce((sum, item) => sum + Number(item.mass || 0), 0);
}

function rosterBodyMass() {
  return state.roster.units.reduce((sum, entry) => {
    const unit = getUnit(entry.unitId);
    return sum + Number(unit?.mass || 0);
  }, 0);
}

function rosterRareCount() {
  return rosterEquipment().filter((item) => item.rarity === "Rare").length;
}

function rosterWarnings() {
  const warnings = [];
  const credits = rosterCreditsUsed();
  const rare = rosterRareCount();
  const commanders = state.roster.units.filter((entry) => getUnit(entry.unitId)?.role === "Commander").length;
  if (!state.roster.units.length) warnings.push({ type: "warn", text: "Добавьте хотя бы один юнит в ростер." });
  if (commanders === 0) warnings.push({ type: "warn", text: "В ростере нет Commander." });
  if (commanders > 1) warnings.push({ type: "warn", text: "В ростере больше одного Commander." });
  if (state.roster.units.length > data.defaults.maxUnits) warnings.push({ type: "warn", text: `Юнитов больше ${data.defaults.maxUnits}.` });
  if (credits > state.roster.budget) warnings.push({ type: "warn", text: `Превышен бюджет на ${credits - state.roster.budget} кредитов.` });
  if (rare > data.defaults.maxRareItems) warnings.push({ type: "warn", text: `Редких предметов больше ${data.defaults.maxRareItems}.` });
  if (!warnings.length) warnings.push({ type: "ok", text: "Ростер проходит базовые проверки." });
  return warnings;
}

function renderBuilder() {
  $("rosterName").value = state.roster.name;
  $("rosterFaction").value = state.roster.faction;
  $("rosterBudget").value = state.roster.budget;

  renderBuilderPool();
  renderRoster();
  renderSavedRosters();
}

function renderBuilderPool() {
  const q = normalize(state.builderQuery);
  const units = data.units.filter((unit) => {
    if (unit.faction !== state.roster.faction) return false;
    if (!q) return true;
    return cardSearchText({ ...unit, kind: "unit" }).includes(q);
  });
  $("poolCount").textContent = units.length;
  $("builderPool").innerHTML = units.map((unit) => `
    <article class="pool-card">
      <img src="${escapeHtml(unit.img)}" alt="${escapeHtml(unit.name)}" loading="lazy">
      <div class="pool-card-body">
        <div class="card-name-row">
          <div>
            <h2 class="card-title">${escapeHtml(unit.name)}</h2>
            <div class="card-subtitle">${escapeHtml(unit.subtitle)} · Mass ${unit.mass}</div>
          </div>
          <span class="faction-badge ${unit.faction}">${escapeHtml(unit.faction)}</span>
        </div>
        <div class="stat-row">
          <div class="stat"><span>MOV</span><strong>${escapeHtml(unit.move)}</strong></div>
          <div class="stat"><span>COMP</span><strong>${escapeHtml(formatValue(unit.competency))}</strong></div>
          <div class="stat"><span>DEF</span><strong>${escapeHtml(unit.defense)}</strong></div>
          <div class="stat"><span>INT</span><strong>${escapeHtml(unit.integrity)}</strong></div>
        </div>
        <button class="pool-add" type="button" data-add-unit="${escapeHtml(unit.id)}">Добавить</button>
      </div>
    </article>
  `).join("") || `<div class="empty-state">Для этой фракции ничего не найдено</div>`;
}

function renderRoster() {
  const credits = rosterCreditsUsed();
  const budget = Number(state.roster.budget || 0);
  const itemMass = rosterItemMass();
  const bodyMass = rosterBodyMass();
  const creditsPercent = budget > 0 ? Math.min(100, Math.round((credits / budget) * 100)) : 0;
  const massPercent = bodyMass > 0 ? Math.min(100, Math.round((itemMass / bodyMass) * 100)) : 0;

  $("creditsText").textContent = `${credits} / ${budget}`;
  $("massText").textContent = `${itemMass} carried`;
  $("creditsMeter").style.width = `${creditsPercent}%`;
  $("creditsMeter").classList.toggle("over", credits > budget);
  $("massMeter").style.width = `${massPercent}%`;
  $("massMeter").classList.toggle("over", false);

  $("rosterWarnings").innerHTML = rosterWarnings()
    .map((item) => `<div class="warning ${item.type === "ok" ? "ok" : ""}">${escapeHtml(item.text)}</div>`)
    .join("");

  $("rosterList").innerHTML = state.roster.units.map(renderRosterUnit).join("") || `<div class="empty-state">Ростер пуст</div>`;
}

function renderRosterUnit(entry) {
  const unit = getUnit(entry.unitId);
  if (!unit) return "";
  const equipped = entry.equipmentIds.map(getEquipment).filter(Boolean);
  const available = availableEquipmentForUnit(unit);
  return `
    <article class="roster-unit">
      <div class="roster-unit-head">
        <div class="roster-unit-title">
          <strong>${escapeHtml(unit.name)}</strong>
          <span>${escapeHtml(unit.subtitle)} · Mass ${unit.mass}</span>
        </div>
        <button class="danger-small" type="button" data-remove-unit="${escapeHtml(entry.instanceId)}" title="Удалить">×</button>
      </div>
      <div class="item-select-row">
        <select data-equip-select="${escapeHtml(entry.instanceId)}" aria-label="Добавить предмет">
          <option value="">Добавить предмет...</option>
          ${available.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${item.credits} cr · ${item.mass} mass</option>`).join("")}
        </select>
        <button type="button" data-equip-add="${escapeHtml(entry.instanceId)}">+</button>
      </div>
      <div class="equipped-list">
        ${equipped.map((item, index) => `
          <div class="item-pill">
            <span>${escapeHtml(item.name)} · ${item.credits} cr</span>
            <button type="button" data-remove-equipment="${escapeHtml(entry.instanceId)}" data-equipment-index="${index}" title="Убрать">×</button>
          </div>
        `).join("") || `<span class="tag">Без предметов</span>`}
      </div>
    </article>
  `;
}

function safeStorageRead() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function safeStorageWrite(rosters) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(rosters));
  } catch {
    // LocalStorage can be unavailable in strict file contexts.
  }
}

function saveRoster() {
  const record = {
    id: `r-${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
    roster: structuredClone(state.roster)
  };
  state.saved = [record, ...state.saved.filter((item) => item.roster.name !== state.roster.name)].slice(0, 12);
  safeStorageWrite(state.saved);
  renderSavedRosters();
}

function loadRoster(id) {
  const record = state.saved.find((item) => item.id === id);
  if (!record) return;
  state.roster = structuredClone(record.roster);
  renderBuilder();
}

function deleteRoster(id) {
  state.saved = state.saved.filter((item) => item.id !== id);
  safeStorageWrite(state.saved);
  renderSavedRosters();
}

function renderSavedRosters() {
  if (!state.saved.length) {
    $("savedRosters").innerHTML = "";
    return;
  }
  $("savedRosters").innerHTML = `
    <div class="saved-title">Сохраненные</div>
    ${state.saved.map((record) => {
      const unitCount = record.roster.units.length;
      const credits = record.roster.units.flatMap((entry) => entry.equipmentIds || []).map(getEquipment).filter(Boolean).reduce((sum, item) => sum + item.credits, 0);
      return `
        <div class="saved-row">
          <div>
            <strong>${escapeHtml(record.roster.name)}</strong>
            <span>${escapeHtml(record.roster.faction)} · ${unitCount} units · ${credits} cr</span>
          </div>
          <div class="saved-row-actions">
            <button type="button" data-load-roster="${escapeHtml(record.id)}">Открыть</button>
            <button type="button" data-delete-roster="${escapeHtml(record.id)}">×</button>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function resetRoster() {
  state.roster = {
    name: "Lunar mission",
    faction: state.roster.faction,
    budget: data.defaults.credits,
    units: []
  };
  renderBuilder();
}

function rosterToText() {
  const lines = [];
  lines.push(`Lunar roster: ${state.roster.name}`);
  lines.push(`Faction: ${state.roster.faction}`);
  lines.push(`Credits: ${rosterCreditsUsed()} / ${state.roster.budget}`);
  lines.push(`Item mass: ${rosterItemMass()}`);
  lines.push("");
  state.roster.units.forEach((entry, index) => {
    const unit = getUnit(entry.unitId);
    if (!unit) return;
    lines.push(`${index + 1}. ${unit.name} - ${unit.subtitle}`);
    const equipped = entry.equipmentIds.map(getEquipment).filter(Boolean);
    if (!equipped.length) {
      lines.push("   Equipment: none");
    } else {
      equipped.forEach((item) => lines.push(`   - ${item.name} (${item.credits} cr, ${item.mass} mass)`));
    }
  });
  lines.push("");
  lines.push("Checks:");
  rosterWarnings().forEach((item) => lines.push(`- ${item.text}`));
  return lines.join("\n");
}

function downloadRoster() {
  const text = rosterToText();
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  const safeName = normalize(state.roster.name).replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, "") || "lunar-roster";
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

function buildRulesIndex() {
  const unitRules = data.units.map((unit) => ({
    id: `unit-${unit.id}`,
    title: `${unit.subtitle}: ${unit.name}`,
    category: "unit",
    tags: [unit.faction, unit.role, ...(unit.keywords || [])],
    body: unit.text
  }));
  const equipmentRules = data.equipment.map((item) => ({
    id: `equipment-${item.id}`,
    title: item.name,
    category: "equipment",
    tags: [item.rarity, item.type, ...(item.traits || []), ...(item.attacks || [])],
    body: item.text
  }));
  return [...data.rules, ...unitRules, ...equipmentRules];
}

function renderRules() {
  const q = normalize(state.rulesQuery);
  const entries = buildRulesIndex().filter((entry) => {
    if (state.rulesFilter !== "all" && entry.category !== state.rulesFilter) return false;
    if (!q) return true;
    return normalize([entry.title, entry.body, ...(entry.tags || [])].join(" ")).includes(q);
  });
  $("rulesCount").textContent = entries.length;
  $("rulesResults").innerHTML = entries.map((entry) => `
    <article class="rule-card">
      <div class="card-name-row">
        <h3>${escapeHtml(entry.title)}</h3>
        <span class="type-badge">${escapeHtml(entry.category)}</span>
      </div>
      <p>${escapeHtml(entry.body)}</p>
      <div class="rule-meta">${(entry.tags || []).slice(0, 8).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    </article>
  `).join("") || `<div class="empty-state">По этому запросу правил не найдено</div>`;
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segment").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.catalogKind = button.dataset.kind;
      renderCatalog();
    });
  });

  document.querySelectorAll(".rule-filter").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".rule-filter").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.rulesFilter = button.dataset.ruleFilter;
      renderRules();
    });
  });

  $("catalogSearch").addEventListener("input", (event) => {
    state.catalogQuery = event.target.value;
    renderCatalog();
  });
  $("catalogFaction").addEventListener("change", (event) => {
    state.catalogFaction = event.target.value;
    renderCatalog();
  });
  $("catalogRole").addEventListener("change", (event) => {
    state.catalogRole = event.target.value;
    renderCatalog();
  });
  $("catalogGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-kind][data-id]");
    if (button) showCardModal(button.dataset.kind, button.dataset.id);
  });

  $("builderSearch").addEventListener("input", (event) => {
    state.builderQuery = event.target.value;
    renderBuilderPool();
  });
  $("rosterName").addEventListener("input", (event) => {
    state.roster.name = event.target.value;
  });
  $("rosterFaction").addEventListener("change", (event) => {
    state.roster.faction = event.target.value;
    state.roster.units = state.roster.units.filter((entry) => getUnit(entry.unitId)?.faction === state.roster.faction);
    renderBuilder();
  });
  $("rosterBudget").addEventListener("input", (event) => {
    state.roster.budget = Number(event.target.value || 0);
    renderRoster();
  });
  $("builderPool").addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-unit]");
    if (button) addUnit(button.dataset.addUnit);
  });
  $("rosterList").addEventListener("click", (event) => {
    const removeUnitBtn = event.target.closest("[data-remove-unit]");
    if (removeUnitBtn) {
      removeUnit(removeUnitBtn.dataset.removeUnit);
      return;
    }
    const addEquipBtn = event.target.closest("[data-equip-add]");
    if (addEquipBtn) {
      const select = document.querySelector(`[data-equip-select="${CSS.escape(addEquipBtn.dataset.equipAdd)}"]`);
      if (select?.value) addEquipment(addEquipBtn.dataset.equipAdd, select.value);
      return;
    }
    const removeEquipBtn = event.target.closest("[data-remove-equipment]");
    if (removeEquipBtn) {
      removeEquipment(removeEquipBtn.dataset.removeEquipment, Number(removeEquipBtn.dataset.equipmentIndex));
    }
  });

  $("saveRosterBtn").addEventListener("click", saveRoster);
  $("exportRosterBtn").addEventListener("click", downloadRoster);
  $("resetRosterBtn").addEventListener("click", resetRoster);
  $("savedRosters").addEventListener("click", (event) => {
    const loadButton = event.target.closest("[data-load-roster]");
    if (loadButton) {
      loadRoster(loadButton.dataset.loadRoster);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-roster]");
    if (deleteButton) deleteRoster(deleteButton.dataset.deleteRoster);
  });

  $("rulesSearch").addEventListener("input", (event) => {
    state.rulesQuery = event.target.value;
    renderRules();
  });

  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", closeCardModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCardModal();
  });
}

function init() {
  buildRoleOptions();
  state.saved = safeStorageRead();
  bindEvents();
  renderCatalog();
  renderBuilder();
  renderRules();
}

init();

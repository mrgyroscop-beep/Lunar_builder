const data = window.LUNAR_DATA;
const i18n = window.LUNAR_I18N || {};
const storageKey = "lunar_builder_rosters_v1";
const langStorageKey = "lunar_builder_lang_v1";

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(langStorageKey);
    if (saved === "ru" || saved === "en") return saved;
  } catch {
    // LocalStorage can be unavailable in strict file contexts.
  }
  return "ru";
}

const state = {
  lang: getInitialLanguage(),
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
    format: data.defaults.format,
    faction: data.defaults.faction,
    oxygenBudget: data.defaults.oxygen,
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

function cloneValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function getPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function formatTemplate(value, params = {}) {
  return String(value ?? "").replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function t(key, params = {}) {
  const current = i18n.ui?.[state.lang];
  const fallback = i18n.ui?.en;
  const value = current?.[key] ?? getPath(current, key) ?? fallback?.[key] ?? getPath(fallback, key) ?? key;
  return formatTemplate(value, params);
}

function dataText(section, id, field, fallback) {
  return i18n[section]?.[state.lang]?.[id]?.[field] ?? fallback;
}

function term(value) {
  return i18n.terms?.[state.lang]?.[value] ?? value;
}

function phrase(value) {
  return String(value ?? "").replace(
    /\b(Piercing|Blunt|Range|Ammo|Shotgun|Rifle|Common|Rare|Ranged|Melee|Mining|Two-Handed|Sidearm|Single Use|Multi Use|Explosive|Cutting|Blinding|Big Kick|Overburdened|Blinded|Entangled)\b/g,
    (match) => term(match)
  );
}

function factionLabel(faction) {
  return i18n.factions?.[state.lang]?.[faction] ?? faction;
}

function formatName(format) {
  return t(`format.${format.id}`);
}

function categoryLabel(category) {
  return t(`category.${category}`);
}

function unitName(unit) {
  return dataText("units", unit.id, "name", unit.name);
}

function unitSubtitle(unit) {
  return dataText("units", unit.id, "subtitle", term(unit.subtitle));
}

function unitText(unit) {
  return dataText("units", unit.id, "text", unit.text);
}

function equipmentName(item) {
  return dataText("equipment", item.id, "name", item.name);
}

function equipmentText(item) {
  return dataText("equipment", item.id, "text", item.text);
}

function ruleTitle(rule) {
  return dataText("rules", rule.id, "title", rule.title);
}

function ruleBody(rule) {
  return dataText("rules", rule.id, "body", rule.body);
}

function trainingText(id, field, fallback) {
  return i18n.trainingGames?.[state.lang]?.[id]?.[field] ?? fallback;
}

function localizeCardField(card, field) {
  if (card.kind === "unit") {
    if (field === "name") return unitName(card);
    if (field === "subtitle") return unitSubtitle(card);
    if (field === "text") return unitText(card);
  }
  if (card.kind === "equipment") {
    if (field === "name") return equipmentName(card);
    if (field === "text") return equipmentText(card);
  }
  return card[field];
}

function applyStaticTranslations() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-term]").forEach((element) => {
    element.textContent = term(element.dataset.i18nTerm);
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    const active = button.dataset.lang === state.lang;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setLanguage(lang) {
  if (lang !== "ru" && lang !== "en") return;
  state.lang = lang;
  try {
    localStorage.setItem(langStorageKey, lang);
  } catch {
    // LocalStorage can be unavailable in strict file contexts.
  }
  applyStaticTranslations();
  buildRoleOptions();
  renderRosterFormatOptions();
  renderCatalog();
  renderBuilder();
  renderGame();
  renderRules();
}

function getFormat(id) {
  return data.formats.find((format) => format.id === id) || data.formats[0];
}

function hydrateRoster(roster = {}) {
  const requestedFormat = getFormat(roster.format || data.defaults.format);
  const fallbackOxygen = requestedFormat.oxygen ?? data.defaults.oxygen;
  const fallbackCredits = requestedFormat.credits ?? data.defaults.credits;
  const oxygenBudget = Number(roster.oxygenBudget ?? roster.oxygen ?? fallbackOxygen);
  const budget = Number(roster.budget ?? roster.credits ?? fallbackCredits);
  const formatId = roster.format || (
    oxygenBudget === requestedFormat.oxygen && budget === requestedFormat.credits
      ? requestedFormat.id
      : "custom"
  );

  return {
    name: roster.name || "Lunar mission",
    format: formatId,
    faction: roster.faction || data.defaults.faction,
    oxygenBudget,
    budget,
    units: (roster.units || []).map((entry) => ({
      instanceId: entry.instanceId || makeInstanceId(),
      unitId: entry.unitId,
      equipmentIds: Array.isArray(entry.equipmentIds) ? entry.equipmentIds : []
    })).filter((entry) => getUnit(entry.unitId))
  };
}

function applyRosterFormat(formatId) {
  const format = getFormat(formatId);
  state.roster.format = format.id;
  if (format.oxygen !== null) state.roster.oxygenBudget = format.oxygen;
  if (format.credits !== null) state.roster.budget = format.credits;
}

function formatValue(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function isCommanderRole(role) {
  return role === "Commander";
}

function isGeneralistRole(role) {
  return role === "Generalist";
}

function isSpecialistRole(role) {
  return typeof role === "string" && role.includes("Specialist");
}

function isTwoHanded(item) {
  return (item?.traits || []).includes("Two-Handed");
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
  return card.kind === "equipment" ? equipmentName(card) : unitName(card);
}

function getCardSubtitle(card) {
  if (card.kind === "equipment") {
    return `${term(card.rarity || "Common")} · ${card.mass} ${t("short.mass")} · ${card.credits} ${t("short.credits")}`;
  }
  return `${unitSubtitle(card)} · ${t("short.oxygen")} ${card.oxygen} · ${t("field.baseMass").toLowerCase()} ${card.mass}`;
}

function cardSearchText(card) {
  return normalize([
    card.name,
    localizeCardField(card, "name"),
    card.subtitle,
    localizeCardField(card, "subtitle"),
    card.faction,
    factionLabel(card.faction),
    card.role,
    term(card.role),
    card.set,
    card.rarity,
    term(card.rarity),
    card.text,
    localizeCardField(card, "text"),
    ...(card.keywords || []),
    ...(card.traits || []),
    ...(card.traits || []).map(term),
    ...(card.attacks || []),
    ...(card.attacks || []).map(phrase)
  ].join(" "));
}

function buildRoleOptions() {
  const roles = [...new Set(data.units.map((unit) => unit.role))].sort();
  $("catalogRole").innerHTML = [
    `<option value="all">${escapeHtml(t("cards.allRoles"))}</option>`,
    ...roles.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(term(role))}</option>`)
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
  $("catalogGrid").innerHTML = cards.map(renderCatalogCard).join("") || `<div class="empty-state">${escapeHtml(t("empty.cards"))}</div>`;
}

function renderCatalogCard(card) {
  const subtitle = getCardSubtitle(card);
  const badge = card.kind === "unit"
    ? `<span class="faction-badge ${getFactionClass(card.faction)}">${escapeHtml(factionLabel(card.faction))}</span>`
    : `<span class="${card.rarity === "Rare" ? "rare-badge" : "type-badge"}">${escapeHtml(term(card.rarity || "Item"))}</span>`;
  const stats = card.kind === "unit"
    ? [
        [t("stat.oxy"), card.oxygen],
        [t("stat.mov"), card.move],
        [t("stat.comp"), formatValue(card.competency)],
        [t("stat.def"), card.defense],
        [t("stat.int"), card.integrity]
      ]
    : [
        [t("stat.mass"), card.mass],
        [t("stat.cr"), card.credits],
        [t("stat.type"), term(card.type)],
        [t("stat.use"), formatValue(card.uses)]
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
          <div class="tag-row">${(tags || []).slice(0, 5).map((tag) => `<span class="tag">${escapeHtml(term(tag))}</span>`).join("")}</div>
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
  if (view === "game") renderGame();
  if (view === "rules") renderRules();
}

function showCardModal(kind, id) {
  const source = kind === "unit" ? getUnit(id) : getEquipment(id);
  if (!source) return;
  const card = { ...source, kind, faction: source.faction || "Neutral" };
  const statRows = kind === "unit"
    ? [
        [t("field.faction"), factionLabel(card.faction)],
        [t("field.role"), term(card.role)],
        [t("field.move"), card.move],
        [t("field.competency"), formatValue(card.competency)],
        [t("field.defense"), card.defense],
        [t("field.oxygen"), card.oxygen],
        [t("field.integrity"), card.integrity],
        [t("field.baseMass"), card.mass],
        [t("field.massTrack"), (card.massTrack || []).join(" / ")],
        [t("field.overburdenAt"), card.overburdenAt],
        [t("field.set"), card.set]
      ]
    : [
        [t("field.type"), term(card.type)],
        [t("field.rarity"), term(card.rarity)],
        [t("field.mass"), card.mass],
        [t("field.credits"), card.credits],
        [t("field.uses"), formatValue(card.uses)],
        [t("field.faction"), factionLabel(card.faction)],
        [t("field.set"), card.set]
      ];
  const tags = kind === "unit" ? card.keywords : card.traits;
  $("modalBody").innerHTML = `
    <img class="modal-card-image" src="${escapeHtml(card.img)}" alt="${escapeHtml(getCardTitle(card))}">
    <div class="modal-info">
      <h2 id="modalTitle">${escapeHtml(getCardTitle(card))}</h2>
      <div class="subtitle">${escapeHtml(kind === "unit" ? unitSubtitle(card) : `${term(card.rarity)} ${term(card.type)}`)}</div>
      <div class="detail-grid">
        ${statRows.map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatValue(value))}</strong></div>`).join("")}
      </div>
      ${(card.attacks || []).length ? `<div class="tag-row">${card.attacks.map((tag) => `<span class="tag">${escapeHtml(phrase(tag))}</span>`).join("")}</div>` : ""}
      <p>${escapeHtml(localizeCardField(card, "text"))}</p>
      <div class="tag-row">${(tags || []).map((tag) => `<span class="tag">${escapeHtml(term(tag))}</span>`).join("")}</div>
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

function entryEquipment(entry) {
  return (entry?.equipmentIds || []).map(getEquipment).filter(Boolean);
}

function equipmentRuleIssue(unit, equipment, equipmentIds = []) {
  if (!unit || !equipment) return t("equip.unknown");
  if (equipment.faction && (state.roster.faction !== equipment.faction || equipment.faction !== unit.faction)) {
    return t("equip.faction");
  }
  if (state.roster.format === "campaignStart" && equipment.rarity === "Rare") {
    return t("equip.campaignRare");
  }
  if (equipment.rarity === "Rare" && isGeneralistRole(unit.role)) {
    return t("equip.generalistRare");
  }
  if (equipment.rarity === "Rare" && !isCommanderRole(unit.role) && !isSpecialistRole(unit.role)) {
    return t("equip.rareRank");
  }
  const isRangedWeapon = equipment.type === "weapon" && (equipment.traits || []).includes("Ranged");
  if (unit.role === "Medical Specialist" && isRangedWeapon) {
    return t("equip.medicalRanged");
  }
  const isRareWeapon = equipment.type === "weapon" && equipment.rarity === "Rare";
  if (unit.role === "Tech Specialist" && isRareWeapon) {
    return t("equip.techRare");
  }
  if (isTwoHanded(equipment)) {
    const equipped = equipmentIds.map(getEquipment).filter(Boolean);
    if (equipped.some(isTwoHanded)) {
      return t("equip.twoHanded");
    }
  }
  return "";
}

function canEquip(unit, equipment, equipmentIds = []) {
  return !equipmentRuleIssue(unit, equipment, equipmentIds);
}

function availableEquipmentForEntry(entry) {
  const unit = entry ? getUnit(entry.unitId) : null;
  return data.equipment.filter((item) => canEquip(unit, item, entry?.equipmentIds || []));
}

function addEquipment(instanceId, equipmentId) {
  const entry = state.roster.units.find((unit) => unit.instanceId === instanceId);
  const unit = entry ? getUnit(entry.unitId) : null;
  const equipment = getEquipment(equipmentId);
  if (!entry || !canEquip(unit, equipment, entry.equipmentIds)) return;
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
  return state.roster.units.flatMap(entryEquipment);
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

function rosterOxygenUsed() {
  return state.roster.units.reduce((sum, entry) => {
    const unit = getUnit(entry.unitId);
    return sum + Number(unit?.oxygen || 0);
  }, 0);
}

function entryMassProfile(entry) {
  const unit = getUnit(entry.unitId);
  const itemMass = entryEquipment(entry).reduce((sum, item) => sum + Number(item.mass || 0), 0);
  const baseMass = Number(unit?.mass || 0);
  const totalMass = baseMass + itemMass;
  const massTrack = unit?.massTrack || [baseMass];
  const overburdenAt = Number(unit?.overburdenAt || Number.POSITIVE_INFINITY);
  const maxMass = Math.max(...massTrack);
  return {
    baseMass,
    itemMass,
    totalMass,
    maxMass,
    overburdenAt,
    overburden: Number.isFinite(overburdenAt) ? Math.max(0, totalMass - overburdenAt + 1) : 0,
    overflow: Math.max(0, totalMass - maxMass)
  };
}

function rosterOverburdenTotal() {
  return state.roster.units.reduce((sum, entry) => sum + entryMassProfile(entry).overburden, 0);
}

function rosterTotals(roster) {
  const hydrated = hydrateRoster(roster);
  const equipment = hydrated.units.flatMap(entryEquipment);
  return {
    roster: hydrated,
    units: hydrated.units.length,
    oxygen: hydrated.units.reduce((sum, entry) => sum + Number(getUnit(entry.unitId)?.oxygen || 0), 0),
    credits: equipment.reduce((sum, item) => sum + Number(item.credits || 0), 0),
    itemMass: equipment.reduce((sum, item) => sum + Number(item.mass || 0), 0)
  };
}

function findTrainingGame(gameId) {
  return (data.trainingGames || []).find((game) => game.id === gameId);
}

function findTrainingTeam(gameId, teamId) {
  const game = findTrainingGame(gameId);
  return game?.teams.find((team) => team.id === teamId);
}

function rosterWarnings() {
  const warnings = [];
  const credits = rosterCreditsUsed();
  const oxygen = rosterOxygenUsed();
  const format = getFormat(state.roster.format);
  const rosterUnits = state.roster.units.map((entry) => ({ entry, unit: getUnit(entry.unitId) })).filter((item) => item.unit);
  const commanders = rosterUnits.filter(({ unit }) => isCommanderRole(unit.role)).length;
  const specialists = rosterUnits.filter(({ unit }) => isSpecialistRole(unit.role)).length;
  const generalists = rosterUnits.filter(({ unit }) => isGeneralistRole(unit.role)).length;
  const specialistAllowance = 1 + Math.floor(generalists / 2);
  if (!state.roster.units.length) warnings.push({ type: "warn", text: t("warn.addUnit") });
  if (commanders === 0) warnings.push({ type: "warn", text: t("warn.noCommander") });
  if (commanders > 1) warnings.push({ type: "warn", text: t("warn.tooManyCommanders") });
  if (oxygen > state.roster.oxygenBudget) warnings.push({ type: "warn", text: t("warn.oxygen", { amount: oxygen - state.roster.oxygenBudget }) });
  if (credits > state.roster.budget) warnings.push({ type: "warn", text: t("warn.credits", { amount: credits - state.roster.budget }) });
  if (format.mode === "campaignStart" && specialists > 1) {
    warnings.push({ type: "warn", text: t("warn.campaignSpecialist") });
  } else if (specialists > specialistAllowance) {
    warnings.push({ type: "warn", text: t("warn.specialists", { allowed: specialistAllowance, generalists }) });
  }
  if (format.mode === "campaignStart" && rosterRareCount() > 0) {
    warnings.push({ type: "warn", text: t("warn.campaignRare") });
  }
  if (state.roster.faction === "Unaligned") {
    warnings.push({ type: "notice", text: t("warn.unaligned") });
  } else {
    const offFaction = rosterUnits.filter(({ unit }) => unit.faction !== state.roster.faction);
    if (offFaction.length) warnings.push({ type: "warn", text: t("warn.offFaction") });
  }

  rosterUnits.forEach(({ entry, unit }) => {
    const equipped = entryEquipment(entry);
    const twoHanded = equipped.filter(isTwoHanded);
    if (twoHanded.length > 1) {
      warnings.push({ type: "warn", text: t("warn.twoHanded", { unit: unitSubtitle(unit) }) });
    }
    equipped.forEach((item) => {
      const issue = equipmentRuleIssue(unit, item, []);
      if (issue) warnings.push({ type: "warn", text: t("warn.itemIssue", { unit: unitSubtitle(unit), item: equipmentName(item), issue }) });
    });
    const mass = entryMassProfile(entry);
    if (mass.overburden > 0) {
      warnings.push({ type: "warn", text: t("warn.overburden", { unit: unitSubtitle(unit), total: mass.totalMass, max: mass.maxMass, count: mass.overburden }) });
    }
    if (mass.overflow > 0) {
      warnings.push({ type: "warn", text: t("warn.overflow", { unit: unitSubtitle(unit), amount: mass.overflow }) });
    }
  });

  if (!warnings.length) warnings.push({ type: "ok", text: t("warn.ok") });
  return warnings;
}

function renderRosterFormatOptions() {
  $("rosterFormat").innerHTML = data.formats
    .map((format) => `<option value="${escapeHtml(format.id)}">${escapeHtml(formatName(format))}</option>`)
    .join("");
}

function renderBuilder() {
  $("rosterName").value = state.roster.name;
  $("rosterFormat").value = state.roster.format;
  $("rosterFaction").value = state.roster.faction;
  $("rosterOxygen").value = state.roster.oxygenBudget;
  $("rosterBudget").value = state.roster.budget;

  renderTrainingGamePanel();
  renderBuilderPool();
  renderRoster();
  renderSavedRosters();
}

function renderTrainingGamePanel() {
  const games = data.trainingGames || [];
  $("trainingGamePanel").innerHTML = games.map((game) => `
    <section class="training-game">
      <div class="training-game-head">
        <div>
          <p class="eyebrow">${escapeHtml(t("training.eyebrow"))}</p>
          <h2>${escapeHtml(trainingText(game.id, "title", game.title))}</h2>
          <p>${escapeHtml(trainingText(game.id, "note", game.note))}</p>
          <span>${escapeHtml(trainingText(game.id, "source", game.source))}</span>
        </div>
        <button class="training-save" type="button" data-save-training-game="${escapeHtml(game.id)}">${escapeHtml(t("builder.saveBoth"))}</button>
      </div>
      <div class="training-teams">
        ${game.teams.map((team) => renderTrainingTeam(game.id, team)).join("")}
      </div>
    </section>
  `).join("");
}

function renderTrainingTeam(gameId, team) {
  const totals = rosterTotals(team.roster);
  const roster = totals.roster;
  return `
    <article class="training-team ${getFactionClass(team.side)}">
      <div class="training-team-head">
        <div>
          <span class="faction-badge ${getFactionClass(team.side)}">${escapeHtml(team.side)}</span>
          <h3>${escapeHtml(trainingText(team.id, "title", team.title))}</h3>
        </div>
        <button type="button" data-load-training-game="${escapeHtml(gameId)}" data-load-training-team="${escapeHtml(team.id)}">${escapeHtml(t("builder.open"))}</button>
      </div>
      <div class="training-stats">
        <div><span>${escapeHtml(t("field.oxygen"))}</span><strong>${totals.oxygen}/${roster.oxygenBudget}</strong></div>
        <div><span>${escapeHtml(t("field.credits"))}</span><strong>${totals.credits}/${roster.budget}</strong></div>
        <div><span>${escapeHtml(t("cards.units"))}</span><strong>${totals.units}</strong></div>
      </div>
      <div class="training-unit-list">
        ${roster.units.map((entry) => {
          const unit = getUnit(entry.unitId);
          const equipped = entryEquipment(entry);
          return `
            <div class="training-unit">
              <strong>${escapeHtml(unit ? unitSubtitle(unit) : t("cards.units"))}</strong>
              <span>${equipped.map((item) => escapeHtml(equipmentName(item))).join(", ") || escapeHtml(t("builder.noItems"))}</span>
            </div>
          `;
        }).join("")}
      </div>
    </article>
  `;
}

function renderBuilderPool() {
  const q = normalize(state.builderQuery);
  const units = data.units.filter((unit) => {
    if (state.roster.faction !== "Unaligned" && unit.faction !== state.roster.faction) return false;
    if (!q) return true;
    return cardSearchText({ ...unit, kind: "unit" }).includes(q);
  });
  $("poolCount").textContent = units.length;
  $("builderPool").innerHTML = units.map((unit) => `
    <article class="pool-card">
      <img src="${escapeHtml(unit.img)}" alt="${escapeHtml(unitName(unit))}" loading="lazy">
      <div class="pool-card-body">
        <div class="card-name-row">
          <div>
            <h2 class="card-title">${escapeHtml(unitName(unit))}</h2>
            <div class="card-subtitle">${escapeHtml(unitSubtitle(unit))} · ${escapeHtml(t("short.oxygen"))} ${unit.oxygen} · ${escapeHtml(t("short.base"))} ${unit.mass}</div>
          </div>
          <span class="faction-badge ${getFactionClass(unit.faction)}">${escapeHtml(factionLabel(unit.faction))}</span>
        </div>
        <div class="stat-row">
          <div class="stat"><span>${escapeHtml(t("stat.oxy"))}</span><strong>${escapeHtml(unit.oxygen)}</strong></div>
          <div class="stat"><span>${escapeHtml(t("stat.mov"))}</span><strong>${escapeHtml(unit.move)}</strong></div>
          <div class="stat"><span>${escapeHtml(t("stat.comp"))}</span><strong>${escapeHtml(formatValue(unit.competency))}</strong></div>
          <div class="stat"><span>${escapeHtml(t("stat.def"))}</span><strong>${escapeHtml(unit.defense)}</strong></div>
          <div class="stat"><span>${escapeHtml(t("stat.int"))}</span><strong>${escapeHtml(unit.integrity)}</strong></div>
        </div>
        <button class="pool-add" type="button" data-add-unit="${escapeHtml(unit.id)}">${escapeHtml(t("builder.add"))}</button>
      </div>
    </article>
  `).join("") || `<div class="empty-state">${escapeHtml(t("builder.noUnits"))}</div>`;
}

function renderRoster() {
  const credits = rosterCreditsUsed();
  const oxygen = rosterOxygenUsed();
  const budget = Number(state.roster.budget || 0);
  const oxygenBudget = Number(state.roster.oxygenBudget || 0);
  const overburden = rosterOverburdenTotal();
  const itemMass = rosterItemMass();
  const creditsPercent = budget > 0 ? Math.min(100, Math.round((credits / budget) * 100)) : 0;
  const oxygenPercent = oxygenBudget > 0 ? Math.min(100, Math.round((oxygen / oxygenBudget) * 100)) : 0;
  const massPercent = overburden > 0 ? Math.min(100, overburden * 25) : 0;

  $("oxygenText").textContent = `${oxygen} / ${oxygenBudget}`;
  $("creditsText").textContent = `${credits} / ${budget}`;
  $("massText").textContent = `${overburden} · ${itemMass} ${t("short.mass")}`;
  $("oxygenMeter").style.width = `${oxygenPercent}%`;
  $("oxygenMeter").classList.toggle("over", oxygen > oxygenBudget);
  $("creditsMeter").style.width = `${creditsPercent}%`;
  $("creditsMeter").classList.toggle("over", credits > budget);
  $("massMeter").style.width = `${massPercent}%`;
  $("massMeter").classList.toggle("over", overburden > 0);

  $("rosterWarnings").innerHTML = rosterWarnings()
    .map((item) => `<div class="warning ${escapeHtml(item.type)}">${escapeHtml(item.text)}</div>`)
    .join("");

  $("rosterList").innerHTML = state.roster.units.map(renderRosterUnit).join("") || `<div class="empty-state">${escapeHtml(t("builder.noRoster"))}</div>`;
}

function renderRosterUnit(entry) {
  const unit = getUnit(entry.unitId);
  if (!unit) return "";
  const equipped = entryEquipment(entry);
  const available = availableEquipmentForEntry(entry);
  const mass = entryMassProfile(entry);
  const massClass = mass.overburden > 0 ? "danger" : "ok";
  return `
    <article class="roster-unit">
      <div class="roster-unit-head">
        <div class="roster-unit-title">
          <strong>${escapeHtml(unitName(unit))}</strong>
          <span>${escapeHtml(unitSubtitle(unit))} · ${escapeHtml(t("short.oxygen"))} ${unit.oxygen} · ${escapeHtml(t("short.load"))} ${mass.totalMass}/${mass.maxMass}</span>
        </div>
        <button class="danger-small" type="button" data-remove-unit="${escapeHtml(entry.instanceId)}" title="${escapeHtml(t("builder.remove"))}">×</button>
      </div>
      <div class="unit-rule-row">
        <span>${escapeHtml(t("short.base"))} ${escapeHtml(mass.baseMass)}</span>
        <span>${escapeHtml(t("short.items"))} ${escapeHtml(mass.itemMass)}</span>
        <span class="${massClass}">${escapeHtml(t("builder.overburden"))} ${escapeHtml(mass.overburden)}</span>
      </div>
      <div class="item-select-row">
        <select data-equip-select="${escapeHtml(entry.instanceId)}" aria-label="${escapeHtml(t("builder.addItemAria"))}">
          <option value="">${escapeHtml(t("builder.addItem"))}</option>
          ${available.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(equipmentName(item))} · ${item.credits} ${escapeHtml(t("short.credits"))} · ${item.mass} ${escapeHtml(t("short.mass"))} · ${escapeHtml(term(item.rarity))}</option>`).join("")}
        </select>
        <button type="button" data-equip-add="${escapeHtml(entry.instanceId)}">+</button>
      </div>
      <div class="equipped-list">
        ${equipped.map((item, index) => `
          <div class="item-pill">
            <button class="item-open" type="button" data-open-equipment="${escapeHtml(item.id)}">${escapeHtml(equipmentName(item))} · ${item.credits} ${escapeHtml(t("short.credits"))} · ${item.mass} ${escapeHtml(t("short.mass"))}</button>
            <button type="button" data-remove-equipment="${escapeHtml(entry.instanceId)}" data-equipment-index="${index}" title="${escapeHtml(t("builder.remove"))}">×</button>
          </div>
        `).join("") || `<span class="tag">${escapeHtml(t("builder.noItems"))}</span>`}
      </div>
    </article>
  `;
}

function renderGame() {
  const credits = rosterCreditsUsed();
  const oxygen = rosterOxygenUsed();
  const overburden = rosterOverburdenTotal();
  $("gameCount").textContent = state.roster.units.length;
  $("gameRosterName").textContent = state.roster.name || "-";
  $("gameOxygen").textContent = `${oxygen} / ${state.roster.oxygenBudget}`;
  $("gameCredits").textContent = `${credits} / ${state.roster.budget}`;
  $("gameOverburden").textContent = overburden;

  $("gameBoard").innerHTML = state.roster.units.map(renderGameUnit).join("") || `
    <div class="empty-state game-empty">
      <button type="button" data-game-open-builder>${escapeHtml(t("game.openBuilder"))}</button>
    </div>
  `;
}

function renderGameUnit(entry, index) {
  const unit = getUnit(entry.unitId);
  if (!unit) return "";
  const equipped = entryEquipment(entry);
  const mass = entryMassProfile(entry);
  const factionClass = getFactionClass(unit.faction);
  return `
    <article class="game-unit ${factionClass}">
      <header class="game-unit-head">
        <div>
          <span class="faction-badge ${factionClass}">${escapeHtml(factionLabel(unit.faction))}</span>
          <h2>${escapeHtml(unitName(unit))}</h2>
          <p>${escapeHtml(unitSubtitle(unit))} · ${escapeHtml(t("short.oxygen"))} ${escapeHtml(unit.oxygen)} · ${escapeHtml(t("short.load"))} ${escapeHtml(mass.totalMass)}/${escapeHtml(mass.maxMass)}</p>
        </div>
        <div class="game-unit-index">${index + 1}</div>
      </header>
      <div class="game-card-spread">
        <button class="game-card game-card-unit" type="button" data-open-card-kind="unit" data-open-card-id="${escapeHtml(unit.id)}">
          <img src="${escapeHtml(unit.img)}" alt="${escapeHtml(unitName(unit))}">
        </button>
        <div class="game-equipment-cards">
          ${equipped.map((item) => `
            <button class="game-card game-card-item" type="button" data-open-card-kind="equipment" data-open-card-id="${escapeHtml(item.id)}">
              <img src="${escapeHtml(item.img)}" alt="${escapeHtml(equipmentName(item))}">
              <span>${escapeHtml(equipmentName(item))}</span>
            </button>
          `).join("") || `<div class="game-no-items">${escapeHtml(t("game.noItems"))}</div>`}
        </div>
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

function upsertSavedRoster(roster, fixedId = "") {
  const hydrated = hydrateRoster(roster);
  const record = {
    id: fixedId || `r-${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
    roster: cloneValue(hydrated)
  };
  state.saved = [
    record,
    ...state.saved.filter((item) => item.id !== record.id && item.roster.name !== hydrated.name)
  ].slice(0, 12);
  safeStorageWrite(state.saved);
  return record;
}

function saveRoster() {
  upsertSavedRoster(state.roster);
  renderSavedRosters();
}

function loadRoster(id) {
  const record = state.saved.find((item) => item.id === id);
  if (!record) return;
  state.roster = hydrateRoster(record.roster);
  renderBuilder();
}

function deleteRoster(id) {
  state.saved = state.saved.filter((item) => item.id !== id);
  safeStorageWrite(state.saved);
  renderSavedRosters();
}

function loadTrainingTeam(gameId, teamId) {
  const team = findTrainingTeam(gameId, teamId);
  if (!team) return;
  state.roster = hydrateRoster(team.roster);
  renderBuilder();
}

function saveTrainingGame(gameId) {
  const game = findTrainingGame(gameId);
  if (!game) return;
  game.teams.forEach((team) => {
    upsertSavedRoster(team.roster, `training-${game.id}-${team.id}`);
  });
  renderSavedRosters();
}

function renderSavedRosters() {
  if (!state.saved.length) {
    $("savedRosters").innerHTML = "";
    return;
  }
  $("savedRosters").innerHTML = `
    <div class="saved-title">${escapeHtml(t("builder.saved"))}</div>
    ${state.saved.map((record) => {
      const roster = hydrateRoster(record.roster);
      const unitCount = roster.units.length;
      const credits = roster.units.flatMap((entry) => entry.equipmentIds || []).map(getEquipment).filter(Boolean).reduce((sum, item) => sum + item.credits, 0);
      const oxygen = roster.units.map((entry) => getUnit(entry.unitId)).filter(Boolean).reduce((sum, unit) => sum + Number(unit.oxygen || 0), 0);
      return `
        <div class="saved-row">
          <div>
            <strong>${escapeHtml(roster.name)}</strong>
            <span>${escapeHtml(factionLabel(roster.faction))} · ${unitCount} ${escapeHtml(t("short.units"))} · ${oxygen}/${roster.oxygenBudget} ${escapeHtml(t("short.oxygen"))} · ${credits}/${roster.budget} ${escapeHtml(t("short.credits"))}</span>
          </div>
          <div class="saved-row-actions">
            <button type="button" data-load-roster="${escapeHtml(record.id)}">${escapeHtml(t("builder.open"))}</button>
            <button type="button" data-delete-roster="${escapeHtml(record.id)}">×</button>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function resetRoster() {
  state.roster = hydrateRoster({
    name: "Lunar mission",
    format: state.roster.format,
    faction: state.roster.faction,
    oxygenBudget: state.roster.oxygenBudget,
    budget: state.roster.budget,
    units: []
  });
  renderBuilder();
}

function rosterToText() {
  const lines = [];
  const format = getFormat(state.roster.format);
  lines.push(`${t("export.title")}: ${state.roster.name}`);
  lines.push(`${t("export.format")}: ${formatName(format)}`);
  lines.push(`${t("export.faction")}: ${factionLabel(state.roster.faction)}`);
  lines.push(`${t("export.oxygen")}: ${rosterOxygenUsed()} / ${state.roster.oxygenBudget}`);
  lines.push(`${t("export.credits")}: ${rosterCreditsUsed()} / ${state.roster.budget}`);
  lines.push(`${t("export.itemMass")}: ${rosterItemMass()}`);
  lines.push(`${t("export.overburden")}: ${rosterOverburdenTotal()}`);
  lines.push("");
  state.roster.units.forEach((entry, index) => {
    const unit = getUnit(entry.unitId);
    if (!unit) return;
    const mass = entryMassProfile(entry);
    lines.push(`${index + 1}. ${unitName(unit)} - ${unitSubtitle(unit)} (${t("short.oxygen")} ${unit.oxygen}, ${t("short.load")} ${mass.totalMass}/${mass.maxMass}, ${t("builder.overburden")} ${mass.overburden})`);
    const equipped = entryEquipment(entry);
    if (!equipped.length) {
      lines.push(`   ${t("export.equipment")}: ${t("export.none")}`);
    } else {
      equipped.forEach((item) => lines.push(`   - ${equipmentName(item)} (${item.credits} ${t("short.credits")}, ${item.mass} ${t("short.mass")})`));
    }
  });
  lines.push("");
  lines.push(`${t("export.checks")}:`);
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
    title: `${unitSubtitle(unit)}: ${unitName(unit)}`,
    category: "unit",
    tags: [factionLabel(unit.faction), term(unit.role), ...(unit.keywords || []).map(term)],
    body: unitText(unit),
    search: [unit.name, unit.subtitle, unit.text, ...(unit.keywords || [])]
  }));
  const equipmentRules = data.equipment.map((item) => ({
    id: `equipment-${item.id}`,
    title: equipmentName(item),
    category: "equipment",
    tags: [term(item.rarity), term(item.type), ...(item.traits || []).map(term), ...(item.attacks || []).map(phrase)],
    body: equipmentText(item),
    search: [item.name, item.text, item.rarity, item.type, ...(item.traits || []), ...(item.attacks || [])]
  }));
  const coreRules = data.rules.map((rule) => ({
    ...rule,
    title: ruleTitle(rule),
    body: ruleBody(rule),
    tags: (rule.tags || []).map(term),
    search: [rule.title, rule.body, ...(rule.tags || [])]
  }));
  return [...coreRules, ...unitRules, ...equipmentRules];
}

function renderRules() {
  const q = normalize(state.rulesQuery);
  const entries = buildRulesIndex().filter((entry) => {
    if (state.rulesFilter !== "all" && entry.category !== state.rulesFilter) return false;
    if (!q) return true;
    return normalize([entry.title, entry.body, ...(entry.tags || []), ...(entry.search || [])].join(" ")).includes(q);
  });
  $("rulesCount").textContent = entries.length;
  $("rulesResults").innerHTML = entries.map((entry) => `
    <article class="rule-card">
      <div class="card-name-row">
        <h3>${escapeHtml(entry.title)}</h3>
        <span class="type-badge">${escapeHtml(categoryLabel(entry.category))}</span>
      </div>
      <p>${escapeHtml(entry.body)}</p>
      <div class="rule-meta">${(entry.tags || []).slice(0, 8).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    </article>
  `).join("") || `<div class="empty-state">${escapeHtml(t("rules.empty"))}</div>`;
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
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
  $("trainingGamePanel").addEventListener("click", (event) => {
    const loadButton = event.target.closest("[data-load-training-game][data-load-training-team]");
    if (loadButton) {
      loadTrainingTeam(loadButton.dataset.loadTrainingGame, loadButton.dataset.loadTrainingTeam);
      return;
    }
    const saveButton = event.target.closest("[data-save-training-game]");
    if (saveButton) saveTrainingGame(saveButton.dataset.saveTrainingGame);
  });
  $("rosterName").addEventListener("input", (event) => {
    state.roster.name = event.target.value;
  });
  $("rosterFormat").addEventListener("change", (event) => {
    applyRosterFormat(event.target.value);
    renderBuilder();
  });
  $("rosterFaction").addEventListener("change", (event) => {
    state.roster.faction = event.target.value;
    if (state.roster.faction !== "Unaligned") {
      state.roster.units = state.roster.units.filter((entry) => getUnit(entry.unitId)?.faction === state.roster.faction);
      state.roster.units.forEach((entry) => {
        entry.equipmentIds = entry.equipmentIds.filter((equipmentId) => {
          const item = getEquipment(equipmentId);
          return item && (!item.faction || item.faction === state.roster.faction);
        });
      });
    }
    renderBuilder();
  });
  $("rosterOxygen").addEventListener("input", (event) => {
    state.roster.oxygenBudget = Number(event.target.value || 0);
    state.roster.format = "custom";
    renderBuilder();
  });
  $("rosterBudget").addEventListener("input", (event) => {
    state.roster.budget = Number(event.target.value || 0);
    state.roster.format = "custom";
    renderBuilder();
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
      const instanceId = addEquipBtn.dataset.equipAdd;
      const select = document.querySelector(`[data-equip-select="${instanceId}"]`);
      if (select?.value) addEquipment(instanceId, select.value);
      return;
    }
    const removeEquipBtn = event.target.closest("[data-remove-equipment]");
    if (removeEquipBtn) {
      removeEquipment(removeEquipBtn.dataset.removeEquipment, Number(removeEquipBtn.dataset.equipmentIndex));
      return;
    }
    const openEquipmentBtn = event.target.closest("[data-open-equipment]");
    if (openEquipmentBtn) showCardModal("equipment", openEquipmentBtn.dataset.openEquipment);
  });
  $("gameBoard").addEventListener("click", (event) => {
    const builderButton = event.target.closest("[data-game-open-builder]");
    if (builderButton) {
      setView("builder");
      return;
    }
    const cardButton = event.target.closest("[data-open-card-kind][data-open-card-id]");
    if (cardButton) showCardModal(cardButton.dataset.openCardKind, cardButton.dataset.openCardId);
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
  applyStaticTranslations();
  buildRoleOptions();
  renderRosterFormatOptions();
  state.roster = hydrateRoster(state.roster);
  state.saved = safeStorageRead().map((record) => ({
    ...record,
    roster: hydrateRoster(record.roster)
  }));
  bindEvents();
  renderCatalog();
  renderBuilder();
  renderRules();
}

init();

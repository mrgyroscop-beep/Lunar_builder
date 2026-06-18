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
  return card.kind === "equipment" ? card.name : `${card.name}`;
}

function getCardSubtitle(card) {
  if (card.kind === "equipment") {
    return `${card.rarity || "Common"} · ${card.mass} mass · ${card.credits} credits`;
  }
  return `${card.subtitle} · Oxy ${card.oxygen} · base mass ${card.mass}`;
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
        ["OXY", card.oxygen],
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
        ["Oxygen", card.oxygen],
        ["Integrity", card.integrity],
        ["Base Mass", card.mass],
        ["Mass Track", (card.massTrack || []).join(" / ")],
        ["Overburden At", card.overburdenAt],
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

function entryEquipment(entry) {
  return (entry?.equipmentIds || []).map(getEquipment).filter(Boolean);
}

function equipmentRuleIssue(unit, equipment, equipmentIds = []) {
  if (!unit || !equipment) return "Неизвестный юнит или предмет.";
  if (equipment.faction && (state.roster.faction !== equipment.faction || equipment.faction !== unit.faction)) {
    return "Фракционный предмет доступен только чистому экипажу этой фракции.";
  }
  if (state.roster.format === "campaignStart" && equipment.rarity === "Rare") {
    return "Кампанию нельзя начинать с rare предметами.";
  }
  if (equipment.rarity === "Rare" && isGeneralistRole(unit.role)) {
    return "Generalist не может использовать rare предметы или оружие.";
  }
  if (equipment.rarity === "Rare" && !isCommanderRole(unit.role) && !isSpecialistRole(unit.role)) {
    return "Rare предметы могут использовать только Commander или Specialist.";
  }
  const isRangedWeapon = equipment.type === "weapon" && (equipment.traits || []).includes("Ranged");
  if (unit.role === "Medical Specialist" && isRangedWeapon) {
    return "Medical Specialist не может использовать ranged weapons.";
  }
  const isRareWeapon = equipment.type === "weapon" && equipment.rarity === "Rare";
  if (unit.role === "Tech Specialist" && isRareWeapon) {
    return "Tech Specialist не может использовать rare weapons.";
  }
  if (isTwoHanded(equipment)) {
    const equipped = equipmentIds.map(getEquipment).filter(Boolean);
    if (equipped.some(isTwoHanded)) {
      return "Юнит может нести только один Two-Handed предмет или оружие.";
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
  if (!state.roster.units.length) warnings.push({ type: "warn", text: "Добавьте хотя бы один юнит в ростер." });
  if (commanders === 0) warnings.push({ type: "warn", text: "В ростере нет Commander." });
  if (commanders > 1) warnings.push({ type: "warn", text: "В ростере больше одного Commander." });
  if (oxygen > state.roster.oxygenBudget) warnings.push({ type: "warn", text: `Превышен лимит Oxygen на ${oxygen - state.roster.oxygenBudget}.` });
  if (credits > state.roster.budget) warnings.push({ type: "warn", text: `Превышен бюджет на ${credits - state.roster.budget} кредитов.` });
  if (format.mode === "campaignStart" && specialists > 1) {
    warnings.push({ type: "warn", text: "Campaign start может начинаться только с одним Specialist." });
  } else if (specialists > specialistAllowance) {
    warnings.push({ type: "warn", text: `Слишком много Specialist: доступно ${specialistAllowance} при ${generalists} Generalist.` });
  }
  if (format.mode === "campaignStart" && rosterRareCount() > 0) {
    warnings.push({ type: "warn", text: "Campaign start не может включать rare предметы." });
  }
  if (state.roster.faction === "Unaligned") {
    warnings.push({ type: "notice", text: "Mixed / Unaligned экипаж не использует commander boons и фракционные предметы." });
  } else {
    const offFaction = rosterUnits.filter(({ unit }) => unit.faction !== state.roster.faction);
    if (offFaction.length) warnings.push({ type: "warn", text: "В чистом экипаже есть юниты другой фракции." });
  }

  rosterUnits.forEach(({ entry, unit }) => {
    const equipped = entryEquipment(entry);
    const twoHanded = equipped.filter(isTwoHanded);
    if (twoHanded.length > 1) {
      warnings.push({ type: "warn", text: `${unit.subtitle}: больше одного Two-Handed предмета.` });
    }
    equipped.forEach((item) => {
      const issue = equipmentRuleIssue(unit, item, []);
      if (issue) warnings.push({ type: "warn", text: `${unit.subtitle}: ${item.name} — ${issue}` });
    });
    const mass = entryMassProfile(entry);
    if (mass.overburden > 0) {
      warnings.push({ type: "warn", text: `${unit.subtitle}: масса ${mass.totalMass}/${mass.maxMass}, Overburdened ${mass.overburden}.` });
    }
    if (mass.overflow > 0) {
      warnings.push({ type: "warn", text: `${unit.subtitle}: масса выше напечатанной шкалы на ${mass.overflow}.` });
    }
  });

  if (!warnings.length) warnings.push({ type: "ok", text: "Ростер проходит проверки правил построения экипажа." });
  return warnings;
}

function renderRosterFormatOptions() {
  $("rosterFormat").innerHTML = data.formats
    .map((format) => `<option value="${escapeHtml(format.id)}">${escapeHtml(format.name)}</option>`)
    .join("");
}

function renderBuilder() {
  $("rosterName").value = state.roster.name;
  $("rosterFormat").value = state.roster.format;
  $("rosterFaction").value = state.roster.faction;
  $("rosterOxygen").value = state.roster.oxygenBudget;
  $("rosterBudget").value = state.roster.budget;

  renderBuilderPool();
  renderRoster();
  renderSavedRosters();
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
      <img src="${escapeHtml(unit.img)}" alt="${escapeHtml(unit.name)}" loading="lazy">
      <div class="pool-card-body">
        <div class="card-name-row">
          <div>
            <h2 class="card-title">${escapeHtml(unit.name)}</h2>
            <div class="card-subtitle">${escapeHtml(unit.subtitle)} · Oxy ${unit.oxygen} · Base ${unit.mass}</div>
          </div>
          <span class="faction-badge ${getFactionClass(unit.faction)}">${escapeHtml(unit.faction)}</span>
        </div>
        <div class="stat-row">
          <div class="stat"><span>OXY</span><strong>${escapeHtml(unit.oxygen)}</strong></div>
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
  $("massText").textContent = `${overburden} tokens · ${itemMass} item mass`;
  $("oxygenMeter").style.width = `${oxygenPercent}%`;
  $("oxygenMeter").classList.toggle("over", oxygen > oxygenBudget);
  $("creditsMeter").style.width = `${creditsPercent}%`;
  $("creditsMeter").classList.toggle("over", credits > budget);
  $("massMeter").style.width = `${massPercent}%`;
  $("massMeter").classList.toggle("over", overburden > 0);

  $("rosterWarnings").innerHTML = rosterWarnings()
    .map((item) => `<div class="warning ${escapeHtml(item.type)}">${escapeHtml(item.text)}</div>`)
    .join("");

  $("rosterList").innerHTML = state.roster.units.map(renderRosterUnit).join("") || `<div class="empty-state">Ростер пуст</div>`;
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
          <strong>${escapeHtml(unit.name)}</strong>
          <span>${escapeHtml(unit.subtitle)} · Oxy ${unit.oxygen} · Load ${mass.totalMass}/${mass.maxMass}</span>
        </div>
        <button class="danger-small" type="button" data-remove-unit="${escapeHtml(entry.instanceId)}" title="Удалить">×</button>
      </div>
      <div class="unit-rule-row">
        <span>Base ${escapeHtml(mass.baseMass)}</span>
        <span>Items ${escapeHtml(mass.itemMass)}</span>
        <span class="${massClass}">Overburden ${escapeHtml(mass.overburden)}</span>
      </div>
      <div class="item-select-row">
        <select data-equip-select="${escapeHtml(entry.instanceId)}" aria-label="Добавить предмет">
          <option value="">Добавить предмет...</option>
          ${available.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${item.credits} cr · ${item.mass} mass · ${item.rarity}</option>`).join("")}
        </select>
        <button type="button" data-equip-add="${escapeHtml(entry.instanceId)}">+</button>
      </div>
      <div class="equipped-list">
        ${equipped.map((item, index) => `
          <div class="item-pill">
            <span>${escapeHtml(item.name)} · ${item.credits} cr · ${item.mass} mass</span>
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
    roster: cloneValue(state.roster)
  };
  state.saved = [record, ...state.saved.filter((item) => item.roster.name !== state.roster.name)].slice(0, 12);
  safeStorageWrite(state.saved);
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

function renderSavedRosters() {
  if (!state.saved.length) {
    $("savedRosters").innerHTML = "";
    return;
  }
  $("savedRosters").innerHTML = `
    <div class="saved-title">Сохраненные</div>
    ${state.saved.map((record) => {
      const roster = hydrateRoster(record.roster);
      const unitCount = roster.units.length;
      const credits = roster.units.flatMap((entry) => entry.equipmentIds || []).map(getEquipment).filter(Boolean).reduce((sum, item) => sum + item.credits, 0);
      const oxygen = roster.units.map((entry) => getUnit(entry.unitId)).filter(Boolean).reduce((sum, unit) => sum + Number(unit.oxygen || 0), 0);
      return `
        <div class="saved-row">
          <div>
            <strong>${escapeHtml(roster.name)}</strong>
            <span>${escapeHtml(roster.faction)} · ${unitCount} units · ${oxygen}/${roster.oxygenBudget} oxy · ${credits}/${roster.budget} cr</span>
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
  lines.push(`Lunar roster: ${state.roster.name}`);
  lines.push(`Format: ${format.name}`);
  lines.push(`Faction: ${state.roster.faction}`);
  lines.push(`Oxygen: ${rosterOxygenUsed()} / ${state.roster.oxygenBudget}`);
  lines.push(`Credits: ${rosterCreditsUsed()} / ${state.roster.budget}`);
  lines.push(`Item mass: ${rosterItemMass()}`);
  lines.push(`Overburden tokens: ${rosterOverburdenTotal()}`);
  lines.push("");
  state.roster.units.forEach((entry, index) => {
    const unit = getUnit(entry.unitId);
    if (!unit) return;
    const mass = entryMassProfile(entry);
    lines.push(`${index + 1}. ${unit.name} - ${unit.subtitle} (Oxy ${unit.oxygen}, Load ${mass.totalMass}/${mass.maxMass}, Overburden ${mass.overburden})`);
    const equipped = entryEquipment(entry);
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

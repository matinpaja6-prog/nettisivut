"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CarFront,
  ChevronRight,
  CornerDownRight,
  FolderTree,
  Plus,
  RotateCcw,
  Save,
  Search,
  Tags,
  Trash2
} from "lucide-react";
import {
  DEFAULT_TAXONOMY,
  fetchSiteTaxonomy,
  saveSiteTaxonomy,
  type CategoryEntry,
  type SiteTaxonomy,
  type VehicleEntry
} from "@/lib/taxonomy";
import styles from "./admin.module.css";

type Props = {
  onToastAction: (kind: "ok" | "err", text: string) => void;
};

type ChildNode = {
  name: string;
  fullPath: string;
  hasChildren: boolean;
  descendantCount: number;
};

function splitPath(value: string) {
  return value
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinPath(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(" / ");
}

function pathMatchesPrefix(path: string[], prefix: string[]) {
  if (prefix.length > path.length) return false;
  return prefix.every((part, index) => path[index] === part);
}

function getChildren(category: CategoryEntry, parentPath: string[]): ChildNode[] {
  const map = new Map<string, ChildNode>();

  for (const subcategory of category.subcategories) {
    const parts = splitPath(subcategory);
    if (!pathMatchesPrefix(parts, parentPath)) continue;
    const childName = parts[parentPath.length];
    if (!childName) continue;

    const fullPath = joinPath([...parentPath, childName]);
    const existing =
      map.get(childName) ??
      {
        name: childName,
        fullPath,
        hasChildren: false,
        descendantCount: 0
      };

    existing.hasChildren = existing.hasChildren || parts.length > parentPath.length + 1;
    existing.descendantCount += 1;
    map.set(childName, existing);
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fi"));
}

function buildSubcategoryGroupsFromCategories(
  taxonomy: SiteTaxonomy
): SiteTaxonomy["subcategoryGroups"] {
  const out: SiteTaxonomy["subcategoryGroups"] = {};

  for (const category of taxonomy.categories) {
    const rootChildren = getChildren(category, []);
    const groups: Record<string, string[]> = {};

    for (const child of rootChildren) {
      const nested = getChildren(category, [child.name]);
      groups[child.name] =
        nested.length > 0
          ? nested.map((node) => node.fullPath)
          : [];
    }

    out[category.key] = groups;
  }

  return out;
}

export default function CategoriesPanel({ onToastAction: onToast }: Props) {
  const [data, setData] = useState<SiteTaxonomy>(DEFAULT_TAXONOMY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<"categories" | "vehicles">("categories");
  const [categorySearch, setCategorySearch] = useState("");
  const [filterVehicle, setFilterVehicle] = useState("");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [openVehicleIndex, setOpenVehicleIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const taxonomy = await fetchSiteTaxonomy();
      if (!cancelled) {
        setData(taxonomy);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function patch(next: Partial<SiteTaxonomy>) {
    setData((prev) => ({ ...prev, ...next }));
  }

  function updateVehicle(idx: number, change: Partial<VehicleEntry>) {
    const next = [...data.vehicles];
    next[idx] = { ...next[idx], ...change };
    patch({ vehicles: next });
  }

  function addVehicle() {
    const key = `Ajoneuvo ${data.vehicles.length + 1}`;
    const nextIndex = data.vehicles.length;
    patch({
      vehicles: [
        ...data.vehicles,
        { key, label: key, pillLabel: key, desc: "", image: "", brands: [] }
      ]
    });
    setOpenVehicleIndex(nextIndex);
  }

  function removeVehicle(idx: number) {
    if (!confirm("Poistetaanko ajoneuvotyyppi?")) return;
    patch({ vehicles: data.vehicles.filter((_, index) => index !== idx) });
    setOpenVehicleIndex((current) => (current === idx ? null : current));
  }

  function addBrand(vehicleIdx: number, brand: string) {
    const value = brand.trim();
    if (!value) return;
    const vehicle = data.vehicles[vehicleIdx];
    if (vehicle.brands.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    updateVehicle(vehicleIdx, { brands: [...vehicle.brands, value] });
  }

  function removeBrand(vehicleIdx: number, brandIdx: number) {
    const vehicle = data.vehicles[vehicleIdx];
    updateVehicle(vehicleIdx, {
      brands: vehicle.brands.filter((_, index) => index !== brandIdx)
    });
  }

  function updateCategory(idx: number, key: string) {
    const next = [...data.categories];
    const oldKey = next[idx]?.key;
    next[idx] = { ...next[idx], key };
    const nextGroups = { ...data.subcategoryGroups };
    if (oldKey && oldKey !== key && nextGroups[oldKey]) {
      nextGroups[key] = nextGroups[oldKey];
      delete nextGroups[oldKey];
    }
    patch({ categories: next, subcategoryGroups: nextGroups });
  }

  function addCategory() {
    const key = `Uusi kategoria ${data.categories.length + 1}`;
    patch({ categories: [...data.categories, { key, subcategories: [], vehicleKeys: [] }] });
    setSelectedCategoryIndex(data.categories.length);
    setSelectedPath([]);
  }

  function removeCategory(idx: number) {
    if (!confirm("Poistetaanko kategoria ja kaikki sen alakategoriat?")) return;
    patch({ categories: data.categories.filter((_, index) => index !== idx) });
    setSelectedCategoryIndex(null);
    setSelectedPath([]);
  }

  function toggleCategoryVehicle(idx: number, vehicleKey: string) {
    const next = [...data.categories];
    const current = next[idx];
    const vehicleKeys = current.vehicleKeys ?? [];
    next[idx] = {
      ...current,
      vehicleKeys: vehicleKeys.includes(vehicleKey)
        ? vehicleKeys.filter((key) => key !== vehicleKey)
        : [...vehicleKeys, vehicleKey]
    };
    patch({ categories: next });
  }

  function setCategoryAllVehicles(idx: number) {
    const next = [...data.categories];
    next[idx] = { ...next[idx], vehicleKeys: [] };
    patch({ categories: next });
  }

  function addChild(categoryIdx: number, parentPath: string[], rawName: string) {
    const name = rawName.trim();
    if (!name) return;
    const nextPath = joinPath([...parentPath, name]);
    const category = data.categories[categoryIdx];
    if (category.subcategories.some((item) => item.toLowerCase() === nextPath.toLowerCase())) return;

    const next = [...data.categories];
    next[categoryIdx] = {
      ...category,
      subcategories: [...category.subcategories, nextPath]
    };
    patch({ categories: next });
  }

  function renameNode(categoryIdx: number, oldPath: string[], newName: string) {
    const clean = newName.trim();
    if (!clean) return;
    const nextPrefix = [...oldPath.slice(0, -1), clean];
    const category = data.categories[categoryIdx];
    const next = [...data.categories];

    next[categoryIdx] = {
      ...category,
      subcategories: category.subcategories.map((item) => {
        const parts = splitPath(item);
        if (!pathMatchesPrefix(parts, oldPath)) return item;
        return joinPath([...nextPrefix, ...parts.slice(oldPath.length)]);
      })
    };

    patch({ categories: next });
    setSelectedPath((current) =>
      pathMatchesPrefix(current, oldPath)
        ? [...nextPrefix, ...current.slice(oldPath.length)]
        : current
    );
  }

  function removeNode(categoryIdx: number, nodePath: string[]) {
    const label = joinPath(nodePath);
    if (!confirm(`Poistetaanko "${label}" ja kaikki sen alakategoriat?`)) return;
    const category = data.categories[categoryIdx];
    const next = [...data.categories];
    next[categoryIdx] = {
      ...category,
      subcategories: category.subcategories.filter((item) => {
        const parts = splitPath(item);
        return !pathMatchesPrefix(parts, nodePath);
      })
    };
    patch({ categories: next });
    if (pathMatchesPrefix(selectedPath, nodePath)) {
      setSelectedPath(nodePath.slice(0, -1));
    }
  }

  async function handleSave() {
    setSaving(true);
    const normalized = {
      ...data,
      subcategoryGroups: buildSubcategoryGroupsFromCategories(data)
    };
    setData(normalized);
    const { error } = await saveSiteTaxonomy(normalized);
    setSaving(false);
    if (error) {
      const msg = (error as { message?: string })?.message ?? "Tuntematon virhe";
      onToast("err", `Tallennus epäonnistui: ${msg}`);
      return;
    }
    onToast("ok", "Kategoriat tallennettu.");
  }

  function handleReset() {
    if (!confirm("Palautetaanko oletuskategoriat? Tämä korvaa nykyiset.")) return;
    setData(DEFAULT_TAXONOMY);
    setSelectedCategoryIndex(null);
    setSelectedPath([]);
  }

  const categorySearchTerm = categorySearch.trim().toLowerCase();
  const filteredCategories = data.categories
    .map((category, index) => ({ category, index }))
    .filter(({ category }) => {
      if (filterVehicle) {
        const keys = category.vehicleKeys ?? [];
        if (keys.length > 0 && !keys.includes(filterVehicle)) return false;
      }
      if (!categorySearchTerm) return true;
      return (
        category.key.toLowerCase().includes(categorySearchTerm) ||
        category.subcategories.some((subcategory) =>
          subcategory.toLowerCase().includes(categorySearchTerm)
        )
      );
    });

  const currentCategory =
    selectedCategoryIndex === null ? null : data.categories[selectedCategoryIndex] ?? null;
  const currentChildren = currentCategory ? getChildren(currentCategory, selectedPath) : [];
  const subcategoryCount = data.categories.reduce(
    (sum, category) => sum + category.subcategories.length,
    0
  );
  const brandCount = data.vehicles.reduce(
    (sum, vehicle) => sum + vehicle.brands.length,
    0
  );

  if (loading) {
    return (
      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            <FolderTree size={18} /> Kategoriat
          </h2>
        </header>
        <p className={styles.empty} aria-busy="true" />
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>
            <FolderTree size={18} /> Kategoriat & ajoneuvot
          </h2>
          <p className={styles.sectionSubtitle}>
            Luo rajattomasti alakategorioita. Kun poraudut tasolle, näet vain sen tason sisällön ja lisäykset.
          </p>
        </div>
        <div className={styles.adminPanelActions}>
          <button type="button" className={styles.secondaryBtn} onClick={handleReset}>
            <RotateCcw size={15} /> Palauta oletukset
          </button>
          <button type="button" className={styles.primaryBtn} onClick={handleSave} disabled={saving}>
            <Save size={15} />
            {saving ? "Tallennetaan..." : "Tallenna"}
          </button>
        </div>
      </header>

      <div className={styles.taxonomySummaryGrid}>
        <SummaryCard icon={<CarFront size={18} />} label="Ajoneuvot" value={data.vehicles.length} />
        <SummaryCard icon={<Tags size={18} />} label="Pääkategoriat" value={data.categories.length} />
        <SummaryCard icon={<FolderTree size={18} />} label="Alikategoriat" value={subcategoryCount} />
        <SummaryCard icon={<Search size={18} />} label="Brändit" value={brandCount} />
      </div>

      <div className={styles.taxonomyToolbar}>
        <div className={styles.taxonomyTabs} role="tablist" aria-label="Kategoriat tai ajoneuvot">
          <button
            type="button"
            className={activePanel === "categories" ? styles.taxonomyTabActive : ""}
            onClick={() => setActivePanel("categories")}
          >
            <FolderTree size={15} /> Kategoriat
          </button>
          <button
            type="button"
            className={activePanel === "vehicles" ? styles.taxonomyTabActive : ""}
            onClick={() => setActivePanel("vehicles")}
          >
            <CarFront size={15} /> Ajoneuvot
          </button>
        </div>

        {activePanel === "categories" && selectedCategoryIndex === null && (
          <label className={styles.taxonomySearch}>
            <Search size={15} />
            <input
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
              placeholder="Hae kategoriaa tai alikategoriaa"
            />
          </label>
        )}
      </div>

      {activePanel === "vehicles" ? (
        <VehicleEditor
          vehicles={data.vehicles}
          openVehicleIndex={openVehicleIndex}
          onToggleOpen={(index) => setOpenVehicleIndex(openVehicleIndex === index ? null : index)}
          onAddVehicle={addVehicle}
          onRemoveVehicle={removeVehicle}
          onUpdateVehicle={updateVehicle}
          onAddBrand={addBrand}
          onRemoveBrand={removeBrand}
        />
      ) : selectedCategoryIndex === null ? (
        <div className={`${styles.appearanceCard} ${styles.taxonomyEditorCard}`}>
          <div className={styles.taxonomyCardHeader}>
            <strong>Pääkategoriat</strong>
            <button type="button" className={styles.secondaryBtn} onClick={addCategory}>
              <Plus size={14} /> Lisää pääkategoria
            </button>
          </div>

          <VehicleFilter
            vehicles={data.vehicles}
            value={filterVehicle}
            onChange={setFilterVehicle}
          />

          <div className={styles.taxonomyList}>
            {filteredCategories.map(({ category, index }) => (
              <button
                key={`${category.key}-${index}`}
                type="button"
                className={styles.taxonomyDrillRow}
                onClick={() => {
                  setSelectedCategoryIndex(index);
                  setSelectedPath([]);
                }}
              >
                <span>
                  <strong>{category.key}</strong>
                  <small>{category.subcategories.length} alikategoriaa</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
            {filteredCategories.length === 0 && (
              <div className={styles.taxonomyEmptyResult}>
                <Search size={18} />
                <span>Ei osumia nykyisillä suodattimilla.</span>
              </div>
            )}
          </div>
        </div>
      ) : currentCategory ? (
        <div className={`${styles.appearanceCard} ${styles.taxonomyEditorCard}`}>
          <CategoryDrillEditor
            category={currentCategory}
            path={selectedPath}
            childNodes={currentChildren}
            vehicles={data.vehicles}
            onBackToRoot={() => {
              setSelectedCategoryIndex(null);
              setSelectedPath([]);
            }}
            onPathChange={setSelectedPath}
            onRenameCategory={(value) => updateCategory(selectedCategoryIndex, value)}
            onRemoveCategory={() => removeCategory(selectedCategoryIndex)}
            onSetAllVehicles={() => setCategoryAllVehicles(selectedCategoryIndex)}
            onToggleVehicle={(vehicleKey) => toggleCategoryVehicle(selectedCategoryIndex, vehicleKey)}
            onAddChild={(name) => addChild(selectedCategoryIndex, selectedPath, name)}
            onOpenChild={(name) => setSelectedPath([...selectedPath, name])}
            onRenameNode={(nodePath, name) => renameNode(selectedCategoryIndex, nodePath, name)}
            onRemoveNode={(nodePath) => removeNode(selectedCategoryIndex, nodePath)}
          />
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className={styles.taxonomySummaryCard}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function VehicleFilter({
  vehicles,
  value,
  onChange
}: {
  vehicles: VehicleEntry[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.taxonomyFilterBlock}>
      <span>Suodata ajoneuvotyypin mukaan</span>
      <div>
        {[{ key: "", label: "Kaikki" }, ...vehicles.map((v) => ({ key: v.key, label: v.label || v.key }))].map((vehicle) => (
          <button
            key={vehicle.key || "all"}
            type="button"
            className={value === vehicle.key ? styles.taxonomyChipActive : styles.taxonomyChip}
            onClick={() => onChange(vehicle.key)}
          >
            {vehicle.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryDrillEditor({
  category,
  path,
  childNodes,
  vehicles,
  onBackToRoot,
  onPathChange,
  onRenameCategory,
  onRemoveCategory,
  onSetAllVehicles,
  onToggleVehicle,
  onAddChild,
  onOpenChild,
  onRenameNode,
  onRemoveNode
}: {
  category: CategoryEntry;
  path: string[];
  childNodes: ChildNode[];
  vehicles: VehicleEntry[];
  onBackToRoot: () => void;
  onPathChange: (path: string[]) => void;
  onRenameCategory: (value: string) => void;
  onRemoveCategory: () => void;
  onSetAllVehicles: () => void;
  onToggleVehicle: (vehicleKey: string) => void;
  onAddChild: (name: string) => void;
  onOpenChild: (name: string) => void;
  onRenameNode: (nodePath: string[], name: string) => void;
  onRemoveNode: (nodePath: string[]) => void;
}) {
  const currentLabel = path.length > 0 ? path.at(-1) ?? category.key : category.key;
  const canRenameNode = path.length > 0;

  return (
    <>
      <div className={styles.taxonomyDrillHeader}>
        <div>
          <div className={styles.taxonomyBreadcrumb}>
            <button type="button" onClick={onBackToRoot}>Kategoriat</button>
            <ChevronRight size={13} />
            <button type="button" onClick={() => onPathChange([])}>{category.key}</button>
            {path.map((part, index) => (
              <span key={`${part}-${index}`}>
                <ChevronRight size={13} />
                <button type="button" onClick={() => onPathChange(path.slice(0, index + 1))}>
                  {part}
                </button>
              </span>
            ))}
          </div>
          <strong>{currentLabel}</strong>
          <small>
            {path.length === 0
              ? "Pääkategorian asetukset ja sen ensimmäinen alakategoriataso."
              : "Tällä tasolla näkyvät vain tämän kategorian suorat alakategoriat."}
          </small>
        </div>
        <button type="button" className={styles.secondaryBtn} onClick={onBackToRoot}>
          Takaisin listaan
        </button>
      </div>

      <div className={styles.taxonomyCurrentEditor}>
        <LabeledInput
          label={canRenameNode ? "Tason nimi" : "Pääkategorian nimi"}
          value={currentLabel}
          onChange={(value) => {
            if (canRenameNode) onRenameNode(path, value);
            else onRenameCategory(value);
          }}
        />

        {path.length === 0 && (
          <div className={styles.taxonomyFilterBlock}>
            <span>Näytä ajoneuvotyypeissä</span>
            <div>
              <button
                type="button"
                className={(category.vehicleKeys ?? []).length === 0 ? styles.taxonomyChipActive : styles.taxonomyChip}
                onClick={onSetAllVehicles}
              >
                Kaikki
              </button>
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.key}
                  type="button"
                  className={(category.vehicleKeys ?? []).includes(vehicle.key) ? styles.taxonomyChipActive : styles.taxonomyChip}
                  onClick={() => onToggleVehicle(vehicle.key)}
                >
                  {vehicle.label || vehicle.key}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.taxonomyLevelPanel}>
        <div className={styles.taxonomyLevelHero}>
          <div>
            <span>{path.length === 0 ? "Lisää pääkategorian alle" : "Lisää nykyisen tason alle"}</span>
            <strong>
              {path.length === 0
                ? category.key
                : joinPath(path)}
            </strong>
          </div>
          <AddInline
            placeholder={
              path.length === 0
                ? "Uuden alakategorian nimi..."
                : `Uusi alakategoria kohtaan ${path.at(-1)}...`
            }
            onAdd={onAddChild}
          />
        </div>

        <div className={styles.taxonomyLevelTitle}>
          <div>
            <CornerDownRight size={16} />
            <strong>Nykyisen tason alakategoriat</strong>
          </div>
          <span>{childNodes.length} kpl</span>
        </div>

        <div className={styles.taxonomyList}>
          {childNodes.map((child) => {
            const nodePath = splitPath(child.fullPath);
            return (
              <div key={child.fullPath} className={styles.taxonomyNodeRow}>
                <button type="button" onClick={() => onOpenChild(child.name)}>
                  <i className={child.hasChildren ? styles.taxonomyNodeFolder : styles.taxonomyNodeLeaf}>
                    {child.hasChildren ? <FolderTree size={16} /> : <CornerDownRight size={15} />}
                  </i>
                  <span>
                    <strong>{child.name}</strong>
                    <small>
                      {child.hasChildren
                        ? `${child.descendantCount} alempaa kategoriaa`
                        : "Ei alakategorioita"}
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button
                  type="button"
                  className={styles.taxonomyDangerIcon}
                  onClick={() => onRemoveNode(nodePath)}
                  aria-label={`Poista ${child.name}`}
                  title={`Poista ${child.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          {childNodes.length === 0 && (
            <div className={styles.taxonomyEmptyResult}>
              <FolderTree size={18} />
              <span>Tällä tasolla ei ole vielä alakategorioita.</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={path.length === 0 ? onRemoveCategory : () => onRemoveNode(path)}
        className={styles.secondaryBtn}
        style={{ alignSelf: "flex-start", color: "#ff8aa0" }}
      >
        <Trash2 size={14} /> {path.length === 0 ? "Poista pääkategoria" : "Poista tämä taso"}
      </button>
    </>
  );
}

function VehicleEditor({
  vehicles,
  openVehicleIndex,
  onToggleOpen,
  onAddVehicle,
  onRemoveVehicle,
  onUpdateVehicle,
  onAddBrand,
  onRemoveBrand
}: {
  vehicles: VehicleEntry[];
  openVehicleIndex: number | null;
  onToggleOpen: (index: number) => void;
  onAddVehicle: () => void;
  onRemoveVehicle: (index: number) => void;
  onUpdateVehicle: (index: number, change: Partial<VehicleEntry>) => void;
  onAddBrand: (vehicleIdx: number, brand: string) => void;
  onRemoveBrand: (vehicleIdx: number, brandIdx: number) => void;
}) {
  return (
    <div className={`${styles.appearanceCard} ${styles.taxonomyEditorCard}`}>
      <div className={styles.taxonomyCardHeader}>
        <strong>Ajoneuvotyypit</strong>
        <button type="button" className={styles.secondaryBtn} onClick={onAddVehicle}>
          <Plus size={14} /> Lisää ajoneuvo
        </button>
      </div>

      <div className={styles.taxonomyList}>
        {vehicles.map((vehicle, index) => {
          const open = openVehicleIndex === index;
          return (
            <div key={`${vehicle.key}-${index}`} className={styles.taxonomyVehicleCard}>
              <button type="button" onClick={() => onToggleOpen(index)}>
                <span>
                  <strong>{vehicle.label || vehicle.key}</strong>
                  <small>{vehicle.brands.length} brändiä</small>
                </span>
                <ChevronRight size={17} />
              </button>

              {open && (
                <div className={styles.taxonomyVehicleFields}>
                  <LabeledInput label="Avain" value={vehicle.key} onChange={(value) => onUpdateVehicle(index, { key: value })} />
                  <LabeledInput label="Yksikkö (kortti)" value={vehicle.label} onChange={(value) => onUpdateVehicle(index, { label: value })} />
                  <LabeledInput label="Monikko (suodatin)" value={vehicle.pillLabel} onChange={(value) => onUpdateVehicle(index, { pillLabel: value })} />
                  <LabeledInput label="Kuvaus" value={vehicle.desc} onChange={(value) => onUpdateVehicle(index, { desc: value })} />
                  <LabeledInput label="Kuvan polku" value={vehicle.image} onChange={(value) => onUpdateVehicle(index, { image: value })} />

                  <div className={styles.taxonomyBrandBlock}>
                    <span>Brändit</span>
                    <div>
                      {vehicle.brands.map((brand, brandIdx) => (
                        <button
                          key={`${brand}-${brandIdx}`}
                          type="button"
                          onClick={() => onRemoveBrand(index, brandIdx)}
                          title="Poista brändi"
                        >
                          {brand} ×
                        </button>
                      ))}
                    </div>
                    <AddInline placeholder="Lisää brändi..." onAdd={(value) => onAddBrand(index, value)} />
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveVehicle(index)}
                    className={styles.secondaryBtn}
                    style={{ alignSelf: "flex-start", color: "#ff8aa0" }}
                  >
                    <Trash2 size={14} /> Poista ajoneuvo
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.taxonomyField}>
      <span>{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function AddInline({
  placeholder,
  onAdd
}: {
  placeholder: string;
  onAdd: (v: string) => void;
}) {
  const [value, setValue] = useState("");

  function commit() {
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  }

  return (
    <div className={styles.taxonomyAddInline}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      <button type="button" onClick={commit} aria-label="Lisää">
        <Plus size={15} />
      </button>
    </div>
  );
}

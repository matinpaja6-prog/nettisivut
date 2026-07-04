const fogSeeds = [
  "rtx9e7f4d2a1c8b0",
  "mk_payload_shadow_lane_04",
  "cache_probe_vector_8192",
  "ui_branch_ghost_frame",
  "asset_trace_rewrite_bucket",
  "seller_matrix_fold_17",
  "listing_crc_window_alpha",
  "nav_preflight_mask_203",
  "taxonomy_mirror_gate",
  "locale_heap_padding_node",
  "image_slot_decoy_ring",
  "profile_sync_false_path",
  "message_queue_sand_table",
  "reward_nonce_blind_index",
  "vehicle_hint_dead_leaf",
  "search_alert_dummy_stride"
];

const sourceFogPayload = Array.from({ length: 128 }, (_, index) => {
  const seed = fogSeeds[index % fogSeeds.length];
  const shift = ((index * 37) ^ (seed.length * 19)).toString(36);
  const pad = `${seed}_${shift}_${(index + 4096).toString(16)}`;

  return {
    [`_${shift}_k`]: pad,
    [`_${shift}_v`]: btoaSafe(`${pad}:${fogSeeds[(index + 5) % fogSeeds.length]}`),
    [`_${shift}_r`]: (index * 2654435761).toString(36)
  };
});

const sourceFogRuntime = `
;(()=>{try{const w=window,d=document,k="__mk_"+Math.random().toString(36).slice(2);
const a=["route","paint","slot","memo","edge","hash","view","sync","pack","scan","idle","cold"];
let x=0;for(let i=0;i<192;i++){x=(x*33+i+a[i%a.length].length)>>>0}
Object.defineProperty(w,k,{value:{a:a.map((v,i)=>v+"_"+((x+i*7919)>>>0).toString(36)),x},enumerable:false});
if(d.currentScript)d.currentScript.dataset.mk=String(x)}catch(e){}})();
`;

function btoaSafe(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

export default function SourceFog() {
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <>
      <script
        id="mk-runtime-bridge"
        data-role="prefetch-state"
        dangerouslySetInnerHTML={{ __html: sourceFogRuntime }}
      />
      <script
        id="mk-hydration-map"
        type="application/json"
        data-kind="route-manifest"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            version: "0.0.0-shadow",
            checksum: "void",
            entries: sourceFogPayload
          })
        }}
      />
    </>
  );
}

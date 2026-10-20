// Local ComfyUI (https://docs.comfy.org/development/comfyui-server/comms_routes) draws scene pictures with an SDXL checkpoint such as Flanime.
const base = host => host.replace(/\/+$/, '');
export const NEGATIVE = 'lowres, worst quality, low quality, bad anatomy, bad hands, extra fingers, missing fingers, text, watermark, signature, logo, blurry, jpeg artifacts, nsfw';

export async function checkComfy({comfyHost, checkpoint, fetchImpl = fetch}) {
  try {
    const response = await fetchImpl(`${base(comfyHost)}/object_info/CheckpointLoaderSimple`, {signal: AbortSignal.timeout(3000)});
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]?.includes(checkpoint));
  } catch { return false; }
}

// Settings follow the Flanime author's recommendation: clip skip 2, Euler a, ~28 steps, CFG 5, around 1024px.
export function sceneWorkflow({checkpoint, positive, negative = NEGATIVE, seed = Math.floor(Math.random() * 2 ** 32)}) {
  return {
    1: {class_type: 'CheckpointLoaderSimple', inputs: {ckpt_name: checkpoint}},
    2: {class_type: 'CLIPSetLastLayer', inputs: {clip: ['1', 1], stop_at_clip_layer: -2}},
    3: {class_type: 'CLIPTextEncode', inputs: {clip: ['2', 0], text: positive}},
    4: {class_type: 'CLIPTextEncode', inputs: {clip: ['2', 0], text: negative}},
    5: {class_type: 'EmptyLatentImage', inputs: {width: 1216, height: 832, batch_size: 1}},
    6: {class_type: 'KSampler', inputs: {model: ['1', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['5', 0], seed, steps: 28, cfg: 5, sampler_name: 'euler_ancestral', scheduler: 'normal', denoise: 1}},
    7: {class_type: 'VAEDecode', inputs: {samples: ['6', 0], vae: ['1', 2]}},
    8: {class_type: 'SaveImage', inputs: {images: ['7', 0], filename_prefix: 'ceack'}},
  };
}

export async function drawScene({comfyHost, checkpoint, positive, fetchImpl = fetch, signal, pollMs = 1000}) {
  const fail = message => Object.assign(new Error(message), {comfy: true});
  let response;
  try {
    response = await fetchImpl(`${base(comfyHost)}/prompt`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: sceneWorkflow({checkpoint, positive})}), signal});
  } catch (error) { if (signal?.aborted) throw error; throw fail('ComfyUI에 연결할 수 없습니다. ComfyUI가 실행 중인지 확인해 주세요.'); }
  if (!response.ok) throw fail(`ComfyUI가 그림 요청을 받지 않았습니다. ${checkpoint} 파일이 models/checkpoints에 있는지 확인해 주세요.`);
  const {prompt_id: id} = await response.json();
  while (true) {
    if (signal?.aborted) throw signal.reason ?? new Error('aborted');
    const history = await (await fetchImpl(`${base(comfyHost)}/history/${id}`, {signal})).json();
    const entry = history[id];
    if (entry?.status?.status_str === 'error') throw fail('ComfyUI에서 그림을 만들다 오류가 났습니다.');
    const image = entry && Object.values(entry.outputs || {}).flatMap(o => o.images || [])[0];
    if (image) {
      const view = await fetchImpl(`${base(comfyHost)}/view?${new URLSearchParams({filename: image.filename, subfolder: image.subfolder || '', type: image.type || 'output'})}`, {signal});
      if (!view.ok) throw fail('ComfyUI에서 그림 파일을 받지 못했습니다.');
      return Buffer.from(await view.arrayBuffer());
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
}

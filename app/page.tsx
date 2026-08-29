"use client";

import { ChangeEvent, DragEvent, FormEvent, lazy, Suspense, useRef, useState } from "react";
import { AuthGateway } from "./components/AuthGateway";

const SoftformMotion = lazy(() => import("./components/SoftformMotion").then((module) => ({ default: module.SoftformMotion })));

type PreviewFile = {
  file: File;
  url: string;
};

const products = [
  {
    name: "云朵花器",
    meta: "雾白 PLA · 12 cm",
    price: "¥ 168",
    className: "product-vase",
  },
  {
    name: "晨光蘑菇灯",
    meta: "暖玉白 · 22 cm",
    price: "¥ 399",
    className: "product-lamp",
  },
  {
    name: "月兔摆件",
    meta: "奶油白 · 8 cm",
    price: "¥ 98",
    className: "product-rabbit",
  },
];

const steps = [
  ["01", "上传灵感", "一张照片、草图或现成 3D 文件都可以。"],
  ["02", "确认方案", "我们检查结构、尺寸与材料，1 个工作日内报价。"],
  ["03", "细腻打印", "逐层成形、手工清理与质检，再温柔送达。"],
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function useFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ file, url: URL.createObjectURL(file) });
    setResult(null);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    useFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    useFile(event.dataTransfer.files?.[0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) {
      setResult({ ok: false, message: "请先上传一张作品照片。" });
      return;
    }

    setIsSubmitting(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    form.set("image", preview.file);

    try {
      const response = await fetch("/api/print-requests", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { requestId?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "提交失败，请稍后再试。 ");
      setResult({
        ok: true,
        message: `已收到你的灵感 · 编号 ${data.requestId?.slice(0, 8).toUpperCase()}，我们会在 1 个工作日内联系你。`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "提交失败，请稍后再试。",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <Suspense fallback={null}><SoftformMotion /></Suspense>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="SOFTFORM 柔造首页">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><b>SOFTFORM</b><small>柔造</small></span>
        </a>
        <nav aria-label="主导航">
          <a href="#collection">现成作品</a>
          <a href="#create">定制打印</a>
          <a href="#process">关于工艺</a>
        </nav>
        <div className="header-actions">
          <AuthGateway />
          <a className="header-cta" href="#create">开始创造 <span>↗</span></a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-image" role="img" aria-label="柔和晨光中的 3D 打印灯、花器与兔子摆件" />
        <div className="hero-copy glass-panel">
          <p className="eyebrow"><span /> 让灵感长出形状</p>
          <h1>把想象，轻轻变成<br /><em>可以触摸的形状</em></h1>
          <p className="hero-text">从一张喜欢的照片，到一件只属于你的物品。<br />我们用细腻的 3D 打印，让每个念头真实落地。</p>
          <div className="hero-actions">
            <a className="button primary" href="#create">上传你的灵感 <span>→</span></a>
            <a className="text-link" href="#collection">看看我们做过的 <span>↘</span></a>
          </div>
        </div>
        <div className="hero-note glass-panel">
          <span className="note-orb" />
          <div><small>今日工作室</small><strong>正在打印 12 件灵感</strong></div>
        </div>
        <a className="scroll-cue" href="#collection" aria-label="向下浏览"><span>↓</span> SCROLL TO FEEL</a>
      </section>

      <section className="trust-strip" aria-label="服务特点">
        <div><span className="mini-icon layers" /><p><b>0.12 mm</b><small>精细层高</small></p></div>
        <div><span className="mini-icon leaf">⌁</span><p><b>环保材料</b><small>可降解 PLA</small></p></div>
        <div><span className="mini-icon sun">☼</span><p><b>5—7 天</b><small>耐心制作</small></p></div>
        <div><span className="mini-icon hand">◡</span><p><b>手工质检</b><small>温柔打磨</small></p></div>
      </section>

      <section className="collection section" id="collection" data-motion-section>
        <div className="section-heading">
          <div><p className="eyebrow"><span /> SOFTFORM COLLECTION</p><h2>日常，也可以有柔软的形状</h2></div>
          <p>一些已经诞生的小物。<br />可直接带走，也可以换成你喜欢的颜色。</p>
        </div>
        <div className="product-grid">
          {products.map((product, index) => (
            <article className={`product-card ${index === 1 ? "featured" : ""}`} key={product.name}>
              <div className={`product-image ${product.className}`}>
                <span>{index === 1 ? "BEST LOVED" : index === 2 ? "NEW" : ""}</span>
                <button aria-label={`收藏${product.name}`}>♡</button>
              </div>
              <div className="product-info"><div><h3>{product.name}</h3><p>{product.meta}</p></div><strong>{product.price}</strong></div>
            </article>
          ))}
        </div>
        <div className="center"><button className="button ghost">漫游全部作品 <span>→</span></button></div>
      </section>

      <section className="create-section" id="create" data-motion-section>
        <div className="create-intro">
          <p className="eyebrow light"><span /> YOUR IDEA, MADE REAL</p>
          <h2>现在，轮到你的<br />灵感长出形状</h2>
          <p>上传一张照片，我们会先为你生成一份轻量 3D 视觉预览，再由设计师检查可打印性。</p>
          <div className="create-badges"><span>无需 3D 建模基础</span><span>1 个工作日内报价</span></div>
        </div>

        <form className="studio-card" onSubmit={handleSubmit}>
          <div className="studio-top">
            <div
              className={`upload-zone ${dragging ? "dragging" : ""} ${preview ? "has-file" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
            >
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleInput} hidden />
              {preview ? (
                <><img src={preview.url} alt="上传的作品预览" /><div className="replace-hint">点击更换照片</div></>
              ) : (
                <div className="upload-empty">
                  <span className="upload-icon">＋</span>
                  <h3>把你的灵感放在这里</h3>
                  <p>拖入或点击上传照片</p>
                  <small>JPG / PNG / WEBP · 最大 10 MB</small>
                </div>
              )}
            </div>

            <div className={`depth-preview ${preview ? "active" : ""}`}>
              <div className="preview-label"><span className="live-dot" /> AI 视觉预览 <small>可拖动想象</small></div>
              {preview ? (
                <div className="photo-object" aria-label="上传照片的 3D 效果预览">
                  <div className="photo-layer layer-back" style={{ backgroundImage: `url(${preview.url})` }} />
                  <div className="photo-layer layer-mid" style={{ backgroundImage: `url(${preview.url})` }} />
                  <div className="photo-layer layer-front" style={{ backgroundImage: `url(${preview.url})` }} />
                  <span className="object-shadow" />
                </div>
              ) : (
                <div className="preview-placeholder"><span /><span /><span /><p>上传后，在这里看见<br />灵感的立体呼吸</p></div>
              )}
              <div className="preview-floor" />
              <small className="preview-disclaimer">视觉预览仅供想象，最终模型由设计师确认</small>
            </div>
          </div>

          <div className="order-fields">
            <label><span>怎么称呼你</span><input name="name" required placeholder="你的名字" /></label>
            <label><span>联系微信或手机</span><input name="contact" required placeholder="方便我们回复你" /></label>
            <label><span>期望尺寸</span><select name="size" defaultValue="中号 · 约 15 cm"><option>小号 · 约 8 cm</option><option>中号 · 约 15 cm</option><option>大号 · 约 25 cm</option><option>还不确定，听听建议</option></select></label>
            <label><span>想对我们说</span><input name="notes" placeholder="用途、颜色或任何小愿望" /></label>
          </div>
          <div className="submit-row">
            <p>提交即表示同意我们仅将图片用于本次报价与制作。</p>
            <button className="button submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "正在送达…" : "交给我们看看"}<span>↗</span></button>
          </div>
          {result && <div className={`form-result ${result.ok ? "success" : "error"}`} role="status">{result.message}</div>}
        </form>
      </section>

      <section className="process section" id="process" data-motion-section>
        <div className="section-heading process-heading"><div><p className="eyebrow"><span /> HOW IT GROWS</p><h2>一件作品的诞生</h2></div><p>机器负责精准，人负责温度。<br />每件作品都会经过我们的手。</p></div>
        <div className="steps">
          {steps.map(([number, title, text]) => (
            <article key={number}><span className="step-number">{number}</span><div className="step-visual"><i /><i /><i /></div><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section className="quote-section" data-motion-section>
        <div className="quote-mark">“</div>
        <blockquote>打印的不只是一件物品，<br />而是一个念头，终于有了重量。</blockquote>
        <p>SOFTFORM 柔造工作室 · 杭州</p>
        <a className="button primary" href="#create">让我的灵感落地 <span>→</span></a>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span><b>SOFTFORM</b><small>柔造</small></span></a>
        <p>让每一个柔软的念头，都有被认真对待的机会。</p>
        <div className="footer-links"><a href="#collection">作品</a><a href="#create">定制</a><a href="#process">工艺</a><a href="mailto:hello@softform.studio">联系我们</a></div>
        <small>© 2026 SOFTFORM STUDIO · Made slowly, held warmly.</small>
      </footer>
    </main>
  );
}

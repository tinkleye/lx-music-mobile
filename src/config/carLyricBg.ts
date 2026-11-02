/**
 * 【车机改造】沉浸式歌词的背景压暗遮罩
 *
 * 原来用「若干等分色块」拼渐变（为了不引入三方渐变库），在 720 高的屏幕上
 * 只分了 7~9 段，每段之间会有明显的横条，看起来一条一条的色块。
 *
 * 这里改成一张极小的 PNG（4 × 160，纯黑 + 竖直方向的透明度渐变），渲染时
 * 拉伸铺满整块区域。图片缩放走的是硬件双线性插值，逐像素渐变，任何高度都
 * 不会有色带，也不用额外装依赖。
 *
 * 用法：底部压暗直接铺；顶部压暗把它旋转 180° 再铺（透明度方向就反过来了）。
 */
const GRADIENT_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAACgCAYAAAArfM2GAAABbklEQVR42o3IXSuYAQBA4WObmY19MW2MmGVbLMTaNKHJIqIta7ImbU0iS1uytKVFsrS2JNJatJZEWkskrSVpay1JkqSlJS35E2513pudem4O/E8hEhwHJDgOSnAcEkKFwxIcYcIRIVw4KhyT4IgQIoXjwgnhpHBKOC1ECdHCGSFGOCucE2KFOOG8EC8kCIlCknBBSBYuCinCJeGycEVIFdKEq0K6kCFkCllCtnBNuC7cEHKEm0KukCfkCwXCLaFQKBJuC8VCiVAqlAnlQoVwR7grVAr3hPtClVAtPBAeCjVCrfBIeCw8EeqEeqFBaBSahKdCs/BMeC60CK3CC6FNeCm8EtqF10KH0Cl0Cd3CG6FHeCu8E94LvUKf0C8MCIPCB+GjMCQMC5+Ez8KIMCqMCePChPBF+CpMClPCtDAjzArfhO/CnDAvLAg/hJ/CL+G3sCgsCcvCirAqrAnrwobwR9gU/gpbwrbwT9gRdvfbA5zE+eFb+XkMAAAAAElFTkSuQmCC'

export const CAR_LYRIC_SCRIM = `data:image/png;base64,${GRADIENT_B64}`

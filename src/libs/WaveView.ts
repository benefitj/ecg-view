/**
 * 波形图绘制：心电/脉搏波/胸腹呼吸
 */
export class WaveView {
  /**
   *画布
   */
  canvas: HTMLCanvasElement;
  /**
   * 画布上下文
   */
  ctx: CanvasRenderingContext2D;
  /**
   *调度器
   */
  timer: any;
  /**
   * 调度间隔
   */
  interval: number;
  /**
   * 接收数据的时间
   */
  rcvTime: number = 0;
  /**
   * 心电数据包，每秒一个包
   */
  models: ViewModel[] = [];
  /**
   * 是否已清理视图
   */
  clear: boolean = false;
  /**
   * 回复状态，判断是否需要自动恢复
   */
  recover: boolean = true;

  constructor(c: HTMLCanvasElement, init?: { onInit(view: WaveView): void }, interval: number = 40) {
    this.canvas = c;
    this.ctx = c.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
    this.interval = interval;
    // 初始化
    init!.onInit(this);
  }

  /**
   * 高度
   */
  height(): number {
    return this.canvas.height;
  }

  /**
   * 宽度
   */
  width(): number {
    return this.canvas.width;
  }

  /**
   * 添加波形数组
   * 
   * @param points 波形数值
   */
  push(waves: number[][]) {
    if (waves && waves.length) {
      this.rcvTime = Date.now();
      let size = Math.min(this.models.length, waves.length);
      for (let i = 0; i < size; i++) {
        this.models[i].push(waves[i]);
      }
      // 重新调度
      if (!this.timer && this.recover) {
        this.startTimer(true);
      }
    }
  }

  /**
   * 开始绘制
   */
  start() {
    this.startTimer(true);
  }

  /**
   * 暂停
   */
  pause() {
    this.stopTimer(true);
  }

  /**
   * 停止绘制
   */
  stop() {
    this.stopTimer(false);
  }

  /**
   * 开始调度
   *
   * @param recover 是否需要恢复
   */
  protected startTimer(recover: boolean) {
    if (this.timer == null) {
      // 40毫秒执行一次
      // 心电每秒200个值      每次绘制8个值
      // 脉搏波每秒50个值     每次绘制2个值
      // 胸腹呼吸每秒25个值   每次绘制1个值
      this.timer = setInterval(() => this.draw(), this.interval);
      this.recover = recover;
    }
  }

  /**
   * 停止调度
   *
   * @param recover 是否需要恢复
   */
  protected stopTimer(recover: boolean) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.recover = recover;
    }
  }

  /**
   * 绘制
   */
  draw() {
    let drawFlag = false;
    if (this.models.length == 1) {
      drawFlag = this.models[0].onDraw(this.ctx) || drawFlag;
    } else {
      for (const m of this.models) {
        drawFlag = m.onDraw(this.ctx, true) || drawFlag;
      }
    }
    if (!drawFlag) {
      // 未绘制
      // 超时自动清理
      if (Date.now() - this.rcvTime >= 2000) {
        // 清理
        this.clearView();
        this.pause();
      }
      return;
    }
  }

  /**
   * 清理视图
   */
  clearView() {
    //this.ctx.clearRect(0, 0, this.width(), this.height());
    try {
      this.onDrawBackground(this.ctx);
      if (this.models.length == 1) {
        this.models[0].clear(this.ctx);
      } else {
        for (const m of this.models) {
          try {
            m.clear(this.ctx);
          } catch (err) {
            console.error(err);
          }
        }
      }
    } finally {
      this.clear = true;
    }
  }

  onDrawBackground(ctx: CanvasRenderingContext2D) {
    // drawGrid(this.canvas, 20, false);
  }
}

/**
 * 数据与数据的模型
 */
export class ViewModel {
  /**
   * 数据队列
   */
  protected waveQ: Array<number[]> = [];
  /**
   * 当前数据包
   */
  protected curPoints: number[] | null = null;
  /**
 * 宽度
 */
  width: number;
  /**
   * 高度
   */
  height: number;
  /**
   * 是否清理视图
   */
  clearView: boolean;
  /**
   * 绘制数量
   */
  drawCount: number;
  /**
   * 中值: (最大值 - 最小值) / 2
   */
  median: number;
  /**
   * 基线
   */
  baseLine: number;
  /**
   * 步长
   */
  step: number;
  /**
   * 压缩比
   */
  scaleRatio: number;
  /**
   * 缓存的最多数量
   */
  maxCacheSize: number;
  /**
   * X的起点
   */
  startX: number;
  /**
   * Y的起点
   */
  startY: number;
  /**
   * X轴
   */
  x: number;
  /**
   * Y轴，默认是基线
   */
  y: number;
  /**
   * 空白间隔
   */
  padding: number = 16;

  constructor(options: ViewModelOptions) {
    this.width = options.width;
    this.height = options.height;
    // 是否清理View
    this.clearView = options.clearView ? options.clearView : true;
    // 绘制数量
    this.drawCount = options.drawCount ? options.drawCount : 1;
    // 中值
    this.median = options.median;
    // 基线
    this.baseLine = Math.floor(options.baseLine ? options.baseLine : (this.height / 2));
    // 步长
    this.step = options.step ? options.step : 1.0;
    // 缓存数量
    this.maxCacheSize = Math.floor(options.maxCacheSize ? options.maxCacheSize : 0);
    // X的起点
    this.startX = options.startX ? options.startX : 0;
    // Y的起点
    this.startY = options.startY ? options.startY : 0;
    // 空白间隔
    this.padding = options.padding ? options.padding : 16;
    // let scale = window.devicePixelRatio;
    // 缩放比
    this.scaleRatio = options.scaleRatio ? options.scaleRatio : 1.0;
    // x轴
    this.x = -1;
    // y轴
    this.y = this.baseLine;
  }

  /**
 * 添加波形数组
 * 
 * @param points 波形数值
 */
  push(points: number[]) {
    if (points) {
      this.waveQ.push(points);
    }
  }

  /**
   * 当绘制时被调用
   * 
   * @param ctx 画布的上下文
   * @returns 是否绘制
   */
  onDraw(ctx: CanvasRenderingContext2D, render: boolean = true): boolean {
    for (;;) {
      if (this.curPoints && this.curPoints.length) {
        // 绘制
        this.drawView(ctx, this.curPoints, render);
        if (!this.maxCacheSize || this.waveQ.length < this.maxCacheSize) {
          return true;
        }
      }
      // 队列中有数据，取出数据，没有就返回
      if (!this.waveQ.length) {
        return false;
      }
      this.curPoints = this.waveQ.shift() as number[];
      // 循环：接着绘制...
    }
  }

  /**
   * 绘制波形数据
   */
  drawView(ctx: CanvasRenderingContext2D, points: number[], render: boolean = true) {
    // 清理部分区域
    ctx.clearRect(this.x, this.startY, this.padding, this.height);

    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    // 绘制线条
    let size = Math.min(points.length, this.drawCount);
    for (let i = 0; i < size; i++) {
      this.x = this.calculateX();
      this.y = this.calculateY(points.shift() as number);
      ctx.lineTo(this.x, this.y);
    }
    if (render) {
      ctx.stroke();
    }
    if (this.x >= this.width) {
      this.x = -1;
    }
  }

  /**
   * 计算X的值
   */
  calculateX() {
    return this.x + this.step;
  }

  /**
   * 计算Y的值
   *
   * @param point 波形值
   */
  calculateY(point: number): number {
    return Math.floor(this.baseLine + (this.median - point) * this.scaleRatio + 0.5);
  }

  /**
   * 清理视图
   */
  clear(ctx: CanvasRenderingContext2D) {
    if(this.clearView) {
      ctx.clearRect(this.startX, this.startY, this.width, this.height);
    }
    this.x = -1;
    this.y = this.baseLine;
  }

}

/**
 * ViewModel的可选项
 */
export interface ViewModelOptions {
  /**
 * 宽度
 */
  width: number;
  /**
   * 高度
   */
  height: number;
  /**
   * 是否清理，默认清理
   */
  clearView?: boolean;
  /**
   * 中值: (最大值 - 最小值) / 2
   */
  median: number;
  /**
   * 绘制数量
   */
  drawCount: number;
  /**
   * 基线，默认高度的一半
   */
  baseLine?: number;
  /**
   * 步长，默认 1
   */
  step?: number;
  /**
   * 压缩比，默认1.0
   */
  scaleRatio?: number;
  /**
   * 缓存的最多数量，默认0，表示不做操作
   */
  maxCacheSize?: number;
  /**
   * X轴的起点，默认0
   */
  startX?: number;
  /**
   * Y轴的起点，默认0
   */
  startY?: number;
  /**
   * 空白间隔
   */
  padding?: number;
}

/**
 * 绘制背景网格
 *
 * @param canvas 画布
 * @param gridSize 网格大小
 */
export const drawGrid = function (canvas: HTMLCanvasElement, gridSize: number, clearRect: boolean = true) {
  let ctx = canvas.getContext("2d", { alpha: true }) as CanvasRenderingContext2D;
  if (clearRect) {
    // 清理
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // 垂直方向数量
  let verticalCount = Math.floor(canvas.width / gridSize);
  let verticalPadding = (canvas.width - Math.floor(verticalCount * gridSize)) / 2;
  // 水平方向数量
  let horizontalCount = Math.floor(canvas.height / gridSize);
  let horizontalPadding = (canvas.height - Math.floor(horizontalCount * gridSize)) / 2;

  // 垂直线
  for (let i = 0; i <= verticalCount; i++) {
    setPaint(ctx, i);
    ctx.beginPath();
    ctx.moveTo(verticalPadding + i * gridSize, horizontalPadding);
    ctx.lineTo(verticalPadding + i * gridSize, canvas.height - horizontalPadding);
    ctx.stroke();
  }

  // 水平线
  for (let i = 0; i <= horizontalCount; i++) {
    setPaint(ctx, i);
    ctx.beginPath();
    ctx.moveTo(verticalPadding, horizontalPadding + i * gridSize);
    ctx.lineTo(canvas.width - verticalPadding, horizontalPadding + i * gridSize);
    ctx.stroke();
  }
};

/**
 * 设置画笔参数
 * 
 * @param ctx 画布上下文
 * @param i 索引
 */
export const setPaint = function (ctx: CanvasRenderingContext2D, i: number) {
  if (i === 0 || (i + 1) % 5 === 0) {
    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = 1;
  } else {
    ctx.strokeStyle = "#990000";
    ctx.lineWidth = 0.5;
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/**
 * 心电图绘制
 */
export class EcgView {
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
   * 心电数据包，每秒一个包
   */
  queue: number[][] = [];
  /**
   * 接收数据的时间
   */
  rcvTime: number = 0;
  /**
   * 缓存的最多数量
   */
  maxCacheSize: number = 0;
  /**
   * 当前数据包
   */
  curPoints: number[] | null;
  /**
   * 基线
   */
  baseLine: number;
  /**
   * 步长
   */
  step: number = 0.5;
  /**
   * 中值: (最大值 - 最小值) / 2
   */
  median: number = 512;
  /**
   * 压缩比
   */
  scaleRatio: number;
  /**
   * X轴
   */
  x: number;
  /**
   * Y轴
   */
  y: number;
  /**
   * 清屏
   */
  clearScreen: boolean = false;
  /**
   * 回复状态，判断是否需要自动恢复
   */
  recover: boolean = true;

  constructor(c: HTMLCanvasElement) {
    this.canvas = c;
    this.ctx = c.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
    this.curPoints = null;

    let height = c.height;

    // 基线
    this.baseLine = height / 2;
    this.x = -1;
    this.y = this.baseLine;

    // let scale = window.devicePixelRatio;
    // 缩放比
    this.scaleRatio = 0.6;

    this.clearView();
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
  push(points: number[]) {
    this.queue.push(points);
    this.rcvTime = Date.now();

    // 重新调度
    if (!this.timer && this.recover) {
      this.startTimer(true);
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
      this.timer = setInterval(() => this.drawNow(), 40);
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

  protected drawNow() {
    for (;;) {
      if (this.curPoints && this.curPoints.length) {
        // 绘制
        this.drawView(this.curPoints);
        this.clearScreen = false;
        if(!this.maxCacheSize || this.queue.length < this.maxCacheSize) {
          return;
        }
      }
      // 队列中有数据，取出数据，没有就返回
      if (!this.queue.length) {
        if (this.clearScreen) {
          return;
        }
        // 超时自动清理
        if (Date.now() - this.rcvTime >= 2000) {
          // 清理
          this.clearView();
          this.pause();
        }
        return;
      }
      this.curPoints = this.queue.shift() as number[];
      // 循环：接着绘制...
    }
  }

  /**
   * 绘制波形数据
   */
  protected drawView(points: number[]) {
    // 绘制
    let ctx = this.ctx;
    this.drawBackgroundGrid();
    // 清理部分区域
    ctx.clearRect(this.x, 0, 16, this.height());

    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    // 绘制线条
    let size = Math.min(points.length, 8);
    for (let i = 0; i < size; i++) {
      this.x = this.x + this.step;
      this.y = this.calculateY(points.shift() as number) + 0.5;
      ctx.lineTo(this.x, this.y);
    }
    ctx.stroke();
    if (this.x >= this.width()) {
      this.x = -1;
    }
  }

  /**
   * 计算Y的值
   *
   * @param point 波形值
   */
  protected calculateY(point: number): number {
    return this.baseLine + (this.median - point) * this.scaleRatio;
  }

  /**
   * 清理视图
   */
  clearView() {
    this.ctx.clearRect(0, 0, this.width(), this.height());
    this.x = -1;
    this.y = this.baseLine;
    this.drawBackgroundGrid();
    this.clearScreen = true;
  }

  protected drawBackgroundGrid() {
    // drawGrid(this.canvas, 20, false);
  }
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

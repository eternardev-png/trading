package com.algoresearch;

import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.Pane;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.TextAlignment;
import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * High-Performance Financial Chart Engine.
 */
public class ChartPane extends Pane {

    // --- Data Model ---
    public static class Candle {
        long time;
        double open, high, low, close;

        public Candle(long time, double open, double high, double low, double close) {
            this.time = time;
            this.open = open;
            this.high = high;
            this.low = low;
            this.close = close;
        }
    }

    private final List<Candle> candles = new ArrayList<>();

    // --- Rendering Components ---
    private final Canvas canvas;
    private final GraphicsContext gc;

    // --- Viewport State ---
    private double pixelsPerCandle = 10.0;
    private double pixelOffset = 0.0;

    // Y-Axis State
    private double minPriceVisible, maxPriceVisible;
    private double priceScaleY; // Pixels per unit (Linear Only)

    // Scale Settings
    private boolean isLogScale = false;
    private boolean isAutoScale = true;
    private double manualMinPrice = 0, manualMaxPrice = 100;

    // Drag State for Scale
    private boolean isDraggingScale = false;
    // private double dragStartMin, dragStartMax; // Removed unused

    // --- Layout Constants ---
    private static final double RIGHT_MARGIN = 60;
    private static final double BOTTOM_MARGIN = 25;
    private static final double CANDLE_GAP_RATIO = 0.2;

    // --- Interaction State ---
    private double lastMouseX, lastMouseY;
    private boolean isDragging = false;
    private boolean isMouseInside = false;
    private double mouseX, mouseY;

    private String statusMessage = "Нет данных";
    private final DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("MMM dd HH:mm")
            .withZone(ZoneId.systemDefault());

    // --- Constants (B&W Theme) ---
    private static final Color COLOR_BG = Color.web("#000000"); // Pure Black
    private static final Color COLOR_GRID = Color.web("#333333");
    private static final Color COLOR_CROSSHAIR = Color.web("#787b86");
    private static final Color COLOR_TEXT_PRIMARY = Color.web("#ffffff");
    private static final Color COLOR_TEXT_SECONDARY = Color.web("#888888");
    private static final Color COLOR_CANDLE_UP = Color.web("#ffffff"); // White
    private static final Color COLOR_CANDLE_DOWN = Color.web("#555555"); // Dark Gray

    // Button Areas on Axis
    private double btnAutoX, btnAutoY, btnAutoW = 20, btnAutoH = 20;
    private double btnLogX, btnLogY, btnLogW = 20, btnLogH = 20;

    public ChartPane() {
        canvas = new Canvas();
        gc = canvas.getGraphicsContext2D();
        getChildren().add(canvas);

        widthProperty().addListener(o -> draw());
        heightProperty().addListener(o -> draw());

        canvas.setOnMousePressed(this::onMousePressed);
        canvas.setOnMouseDragged(this::onMouseDragged);
        canvas.setOnMouseReleased(e -> {
            isDragging = false;
            isDraggingScale = false;
        });
        canvas.setOnScroll(this::onScroll);
        canvas.setOnMouseMoved(this::onMouseMoved);
        canvas.setOnMouseExited(e -> {
            isMouseInside = false;
            draw();
        });
        canvas.setOnMouseEntered(e -> isMouseInside = true);

        setStyle("-fx-background-color: #000000;");
    }

    public void setLogScale(boolean log) {
        this.isLogScale = log;
        draw();
    }

    public void setAutoScale(boolean auto) {
        this.isAutoScale = auto;
        if (auto)
            draw();
    }

    public boolean isLogScale() {
        return isLogScale;
    }

    public boolean isAutoScale() {
        return isAutoScale;
    }

    // --- Data Methods ---

    public void setStatus(String msg) {
        this.statusMessage = msg;
        draw();
    }

    public void setData(String jsonResponse) {
        candles.clear();
        try {
            if (jsonResponse == null || jsonResponse.isEmpty()) {
                setStatus("Нет данных");
                draw();
                return;
            }

            JSONObject root = new JSONObject(jsonResponse);
            if (!root.has("data")) {
                setStatus("Ошибка: Нет ключа 'data'");
                return;
            }
            JSONArray data = root.getJSONArray("data");

            for (int i = 0; i < data.length(); i++) {
                JSONObject obj = data.getJSONObject(i);
                candles.add(new Candle(
                        obj.getLong("time"),
                        obj.getDouble("open"),
                        obj.getDouble("high"),
                        obj.getDouble("low"),
                        obj.getDouble("close")));
            }

            scrollToEnd();
            statusMessage = "";
            draw();

        } catch (Exception e) {
            e.printStackTrace();
            setStatus("Ошибка парсинга: " + e.getClass().getSimpleName());
        }
    }

    public void generateTestCandles() {
        // Keep as fallback
        candles.clear();
        double price = 10000;
        long time = System.currentTimeMillis() / 1000 - (1000 * 3600);
        Random r = new Random();

        for (int i = 0; i < 1000; i++) {
            double open = price;
            double change = (r.nextDouble() - 0.5) * (price * 0.02);
            double close = open + change;
            double high = Math.max(open, close) + r.nextDouble() * (price * 0.005);
            double low = Math.min(open, close) - r.nextDouble() * (price * 0.005);

            candles.add(new Candle(time, open, high, low, close));
            price = close;
            time += 3600;
        }
        scrollToEnd();
        statusMessage = "";
        draw();
    }

    // --- Layout & Rendering ---

    @Override
    protected void layoutChildren() {
        super.layoutChildren();
        canvas.setWidth(getWidth());
        canvas.setHeight(getHeight());
        draw();
    }

    private void scrollToEnd() {
        if (candles.isEmpty())
            return;
        double chartW = getWidth() - RIGHT_MARGIN;
        double totalWidth = candles.size() * pixelsPerCandle;
        if (totalWidth > chartW) {
            pixelOffset = totalWidth - chartW + (pixelsPerCandle * 5);
        } else {
            pixelOffset = -50;
        }
    }

    private double getY(double price, double h) {
        if (isLogScale) {
            double logPrice = Math.log10(price);
            double logMin = Math.log10(minPriceVisible);
            double logMax = Math.log10(maxPriceVisible);
            double range = logMax - logMin;
            if (range == 0)
                range = 1;
            return h - ((logPrice - logMin) / range) * h;
        } else {
            return h - (price - minPriceVisible) * priceScaleY;
        }
    }

    private double getPriceAtY(double y, double h) {
        if (isLogScale) {
            double logMin = Math.log10(minPriceVisible);
            double logMax = Math.log10(maxPriceVisible);
            double range = logMax - logMin;
            double norm = (h - y) / h;
            double logPrice = logMin + (norm * range);
            return Math.pow(10, logPrice);
        } else {
            return minPriceVisible + (h - y) / priceScaleY;
        }
    }

    private void draw() {
        double w = getWidth();
        double h = getHeight();

        gc.setFill(COLOR_BG);
        gc.fillRect(0, 0, w, h);

        if (candles.isEmpty()) {
            gc.setStroke(COLOR_TEXT_PRIMARY);
            gc.setTextAlign(TextAlignment.CENTER);
            gc.strokeText(statusMessage, w / 2, h / 2);
            return;
        }

        double chartW = w - RIGHT_MARGIN;
        double chartH = h - BOTTOM_MARGIN;

        int startIndex = (int) Math.floor(pixelOffset / pixelsPerCandle);
        int endIndex = (int) Math.ceil((pixelOffset + chartW) / pixelsPerCandle);

        startIndex = Math.max(0, startIndex);
        endIndex = Math.min(candles.size() - 1, endIndex);

        if (startIndex > endIndex)
            return;

        if (isAutoScale) {
            double localMin = Double.MAX_VALUE;
            double localMax = Double.MIN_VALUE;

            for (int i = startIndex; i <= endIndex; i++) {
                Candle c = candles.get(i);
                if (c.low < localMin)
                    localMin = c.low;
                if (c.high > localMax)
                    localMax = c.high;
            }

            if (localMin == Double.MAX_VALUE) {
                localMin = 0;
                localMax = 100;
            }

            double range = localMax - localMin;
            if (range == 0)
                range = 1.0;
            double padding = range * 0.05;

            minPriceVisible = localMin - padding;
            maxPriceVisible = localMax + padding;

            manualMinPrice = minPriceVisible;
            manualMaxPrice = maxPriceVisible;
        } else {
            minPriceVisible = manualMinPrice;
            maxPriceVisible = manualMaxPrice;
        }

        if (isLogScale && minPriceVisible <= 0)
            minPriceVisible = 0.0001;

        double priceRange = maxPriceVisible - minPriceVisible;
        if (priceRange <= 0)
            priceRange = 1.0;

        priceScaleY = chartH / priceRange;

        drawGrid(chartW, chartH, minPriceVisible, maxPriceVisible);

        double candleBodyWidth = pixelsPerCandle * (1.0 - CANDLE_GAP_RATIO);

        for (int i = startIndex; i <= endIndex; i++) {
            Candle c = candles.get(i);
            double xCenter = (i * pixelsPerCandle) - pixelOffset + (pixelsPerCandle / 2.0);
            double xLeft = xCenter - (candleBodyWidth / 2.0);

            double yHigh = getY(c.high, chartH);
            double yLow = getY(c.low, chartH);
            double yOpen = getY(c.open, chartH);
            double yClose = getY(c.close, chartH);

            Color color = (c.close >= c.open) ? COLOR_CANDLE_UP : COLOR_CANDLE_DOWN;
            gc.setStroke(color);
            gc.setFill(color);

            double xLine = Math.round(xCenter) + 0.5;
            gc.setLineWidth(1.0);
            gc.strokeLine(xLine, yHigh, xLine, yLow);

            double yTop = Math.min(yOpen, yClose);
            double height = Math.abs(yClose - yOpen);
            if (height < 1.0)
                height = 1.0;

            gc.fillRect(xLeft, yTop, candleBodyWidth, height);
        }

        drawAxes(w, h, chartW, chartH);
        drawCrosshair(w, h, chartW, chartH);
        drawOverlay();
    }

    private void drawGrid(double w, double h, double minP, double maxP) {
        gc.setStroke(COLOR_GRID);
        gc.setLineWidth(0.5);

        int numLines = 10;
        for (int i = 0; i <= numLines; i++) {
            double ratio = (double) i / numLines;
            double y = h * ratio;
            gc.strokeLine(0, y, w, y);
        }
    }

    private void drawOverlay() {
        double x = 10;
        double y = 20;

        gc.setFont(Font.font("Arial Bold", 14));
        gc.setFill(COLOR_TEXT_PRIMARY);
        gc.setTextAlign(TextAlignment.LEFT);
        gc.fillText("BTC/USDT", x, y);

        Candle target = null;
        if (isMouseInside && !isDragging) {
            double indexD = (mouseX + pixelOffset) / pixelsPerCandle;
            int index = (int) Math.round(indexD - 0.5);
            if (index >= 0 && index < candles.size())
                target = candles.get(index);
        }
        if (target == null && !candles.isEmpty())
            target = candles.get(candles.size() - 1);

        if (target != null) {
            gc.setFont(Font.font("Menlo", 11));
            double lineY = y + 20;
            drawLegendValue(x, lineY, "OTK", target.open);
            drawLegendValue(x + 80, lineY, "MAKC", target.high);
            drawLegendValue(x + 160, lineY, "MHH", target.low);
            drawLegendValue(x + 240, lineY, "3AKP", target.close);

            double change = target.close - target.open;
            double pct = (change / target.open) * 100;
            Color cColor = (change >= 0) ? COLOR_CANDLE_UP : COLOR_CANDLE_DOWN;

            gc.setFill(cColor);
            gc.fillText(String.format("%+.2f (%+.2f%%)", change, pct), x + 320, lineY);
        }
    }

    private void drawLegendValue(double x, double y, String label, double val) {
        gc.setFill(COLOR_TEXT_SECONDARY);
        gc.fillText(label, x, y);
        gc.setFill(COLOR_TEXT_PRIMARY);
        gc.fillText(String.format("%.2f", val), x + 35, y);
    }

    private void drawAxes(double w, double h, double chartW, double chartH) {
        gc.setFill(COLOR_BG);
        gc.fillRect(chartW, 0, RIGHT_MARGIN, chartH);
        gc.setStroke(COLOR_GRID);
        gc.strokeLine(chartW, 0, chartW, chartH);

        gc.setFill(COLOR_TEXT_SECONDARY);
        gc.setFont(Font.font("Arial", 10));

        int numLines = 10;
        for (int i = 0; i <= numLines; i++) {
            double ratio = (double) i / numLines;
            double y = chartH * ratio;
            double p = getPriceAtY(y, chartH);
            gc.fillText(String.format("%.2f", p), chartW + 5, y + 4);
        }

        gc.strokeLine(0, chartH, w, chartH);

        // Axis Controls
        btnLogX = w - 25;
        btnLogY = h - BOTTOM_MARGIN - 25;

        btnAutoX = w - 50;
        btnAutoY = h - BOTTOM_MARGIN - 25;

        gc.setFill(isAutoScale ? Color.web("#2962ff") : COLOR_TEXT_SECONDARY);
        gc.setFont(Font.font("Arial Bold", 12));
        gc.fillText("A", btnAutoX + 5, btnAutoY + 15);

        gc.setFill(isLogScale ? Color.web("#2962ff") : COLOR_TEXT_SECONDARY);
        gc.fillText("Л", btnLogX + 5, btnLogY + 15);
    }

    private void drawCrosshair(double w, double h, double chartW, double chartH) {
        if (!isMouseInside || isDragging)
            return;
        if (mouseX > chartW || mouseY > chartH)
            return;

        gc.setStroke(COLOR_CROSSHAIR);
        gc.setLineDashes(4);
        gc.setLineWidth(1.0);

        gc.strokeLine(0, mouseY, chartW, mouseY);
        gc.strokeLine(mouseX, 0, mouseX, chartH);
        gc.setLineDashes(null);

        double priceVal = getPriceAtY(mouseY, chartH);
        drawLabelRight(chartW, mouseY, String.format("%.2f", priceVal));

        double indexD = (mouseX + pixelOffset) / pixelsPerCandle;
        int index = (int) Math.round(indexD - 0.5);
        if (index >= 0 && index < candles.size()) {
            String dateStr = dateFormatter.format(Instant.ofEpochSecond(candles.get(index).time));
            drawLabelBottom(mouseX, chartH, dateStr);
        }
    }

    private void drawLabelRight(double x, double y, String text) {
        gc.setFill(Color.web("#363a45"));
        gc.fillRect(x, y - 10, RIGHT_MARGIN, 20);
        gc.setFill(Color.WHITE);
        gc.fillText(text, x + 5, y + 4);
    }

    private void drawLabelBottom(double x, double y, String text) {
        double width = 80;
        gc.setFill(Color.web("#363a45"));
        gc.fillRect(x - width / 2, y, width, BOTTOM_MARGIN);
        gc.setFill(Color.WHITE);
        gc.setTextAlign(TextAlignment.CENTER);
        gc.fillText(text, x, y + 15);
    }

    private void onMousePressed(MouseEvent e) {
        lastMouseX = e.getX();
        lastMouseY = e.getY();

        // Button Hits?
        if (e.getX() >= btnAutoX && e.getX() <= btnAutoX + btnAutoW &&
                e.getY() >= btnAutoY && e.getY() <= btnAutoY + btnAutoH) {
            setAutoScale(!isAutoScale);
            return;
        }

        if (e.getX() >= btnLogX && e.getX() <= btnLogX + btnLogW &&
                e.getY() >= btnLogY && e.getY() <= btnLogY + btnLogH) {
            setLogScale(!isLogScale);
            return;
        }

        double chartW = getWidth() - RIGHT_MARGIN;
        if (e.getX() > chartW) {
            isDraggingScale = true;
            isAutoScale = false;
        } else {
            isDragging = true;
        }
    }

    private void onMouseDragged(MouseEvent e) {
        double dy = lastMouseY - e.getY();

        if (isDraggingScale) {
            // Drag Logic for Scale (Right Margin)
            double sensitivity = 0.003;
            double factor = 1.0 - (dy * sensitivity);

            if (factor < 0.1)
                factor = 0.1;
            if (factor > 10.0)
                factor = 10.0;

            if (isLogScale) {
                double logMin = Math.log10(manualMinPrice);
                double logMax = Math.log10(manualMaxPrice);
                double logCenter = (logMin + logMax) / 2.0;
                double logRange = logMax - logMin;

                double newLogRange = logRange * factor;
                if (newLogRange < 0.0001)
                    newLogRange = 0.0001;

                double newLogMin = logCenter - (newLogRange / 2.0);
                double newLogMax = logCenter + (newLogRange / 2.0);

                manualMinPrice = Math.pow(10, newLogMin);
                manualMaxPrice = Math.pow(10, newLogMax);
            } else {
                double range = manualMaxPrice - manualMinPrice;
                double center = manualMinPrice + (range / 2.0);

                double newRange = range * factor;
                if (newRange < 0.000001)
                    newRange = 0.000001;

                manualMinPrice = center - (newRange / 2.0);
                manualMaxPrice = center + (newRange / 2.0);
            }

            draw();
            lastMouseX = e.getX();
            lastMouseY = e.getY();
            return;
        }

        if (isDragging) {
            double dx = e.getX() - lastMouseX;
            boolean changed = false;

            // X-Axis Pan (Standard Grab: Drag Right -> Move View Right -> Offset Decreases)
            if (Math.abs(dx) > 0) {
                pixelOffset -= dx;
                changed = true;
            }

            // Y-Axis Pan (Vertical Movement)
            if (Math.abs(dy) > 0) {
                isAutoScale = false;
                double chartH = getHeight() - BOTTOM_MARGIN;

                if (isLogScale) {
                    double logMin = Math.log10(manualMinPrice);
                    double logMax = Math.log10(manualMaxPrice);
                    double logRange = logMax - logMin;
                    double logPerPixel = logRange / chartH;

                    // Drag UP (dy > 0) -> Candles UP -> Lower Prices -> min/max decrease
                    double logDelta = dy * logPerPixel;

                    double newLogMin = logMin - logDelta; // Subtract to make prices decrease when dragging up
                    double newLogMax = logMax - logDelta; // Subtract to make prices decrease when dragging up

                    manualMinPrice = Math.pow(10, newLogMin);
                    manualMaxPrice = Math.pow(10, newLogMax);

                } else {
                    double range = manualMaxPrice - manualMinPrice;
                    double pricePerPixel = range / chartH;

                    // Drag UP (dy > 0) -> Candles UP -> Lower Prices -> min/max decrease
                    // If I drag UP, I expect the view to move UP => I see what's BELOW => Lower
                    // Prices.
                    // So Prices should DECREASE.

                    double priceDelta = dy * pricePerPixel;
                    manualMinPrice -= priceDelta; // Subtract to make prices decrease when dragging up
                    manualMaxPrice -= priceDelta; // Subtract to make prices decrease when dragging up
                }
                changed = true;
            }

            if (changed)
                draw();
        }
        lastMouseX = e.getX();
        lastMouseY = e.getY();
    }

    private void onScroll(ScrollEvent e) {
        double deltaY = e.getDeltaY();
        if (deltaY == 0)
            return;

        double zoomFactor = (deltaY > 0) ? 1.1 : 0.9;

        double oldPPC = pixelsPerCandle;
        double newPPC = oldPPC * zoomFactor;

        if (newPPC < 1.0)
            newPPC = 1.0;
        if (newPPC > 100.0)
            newPPC = 100.0;

        double indexUnderMouse = (pixelOffset + e.getX()) / oldPPC;
        double newOffset = (indexUnderMouse * newPPC) - e.getX();

        pixelsPerCandle = newPPC;
        pixelOffset = newOffset;

        draw();
    }

    private void onMouseMoved(MouseEvent e) {
        mouseX = e.getX();
        mouseY = e.getY();
        draw();
    }
}

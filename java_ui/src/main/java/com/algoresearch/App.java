package com.algoresearch;

import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;

public class App extends Application {

    // private BorderPane root; // Removed as root is now a local variable in
    // start()
    private ChartPane chartPane;
    private ApiClient apiClient;

    @Override
    public void start(Stage stage) {
        apiClient = new ApiClient("http://127.0.0.1:8000/api/v1"); // Re-added the base URL
        BorderPane root = new BorderPane();

        // 1. Top Control Panel (Custom High-Fidelity)
        ControlPanel controlPanel = new ControlPanel(this);
        root.setTop(controlPanel);

        // 2. Left Toolbar (Drawing Tools)
        VBox leftToolbar = new VBox();
        leftToolbar.getStyleClass().add("side-toolbar");
        // Add dummy buttons for now
        leftToolbar.getChildren().addAll(
                createIconBtn("✛"), // Cursor
                createIconBtn("／"), // Line
                createIconBtn("Fib"), // Fib
                createIconBtn("T"), // Text
                createIconBtn("☺") // Icon
        );
        root.setLeft(leftToolbar);

        // 3. Center Chart
        chartPane = new ChartPane();
        // Wrap chart in a container if needed, or put directly
        root.setCenter(chartPane);

        // 4. Right Panel (Watchlist)
        VBox rightPanel = new VBox();
        rightPanel.getStyleClass().add("right-panel");
        Label wlHeader = new Label("СПИСОК");
        wlHeader.getStyleClass().add("panel-header");
        // Dummy Watchlist Items
        VBox wlItems = new VBox();
        wlItems.getChildren().addAll(
                createWlItem("BTC/USDT", "96,450.00", "+2.5%"),
                createWlItem("ETH/USDT", "2,500.00", "-1.2%"),
                createWlItem("SPX", "4,800.00", "+0.5%"));
        rightPanel.getChildren().addAll(wlHeader, wlItems);
        root.setRight(rightPanel);

        Scene scene = new Scene(root, 1200, 800);
        scene.getStylesheets().add(getClass().getResource("/styles.css").toExternalForm());

        stage.setTitle("AlgoResearch Lab");
        stage.setScene(scene);
        stage.show();

        // Initial Fetch
        apiClient = new ApiClient("http://127.0.0.1:8000/api/v1"); // Re-added the base URL
        fetchData("BTC/USDT", "1d");
    }

    private Button createIconBtn(String text) {
        Button b = new Button(text);
        b.getStyleClass().add("button");
        b.setPrefWidth(30);
        b.setPrefHeight(30);
        return b;
    }

    private HBox createWlItem(String sym, String price, String chg) {
        HBox box = new HBox();
        box.setPadding(new javafx.geometry.Insets(8, 10, 8, 10));
        box.setSpacing(10);
        Label s = new Label(sym);
        s.setTextFill(javafx.scene.paint.Color.WHITE);
        s.setPrefWidth(80);
        Label p = new Label(price);
        p.setTextFill(javafx.scene.paint.Color.web("#26a69a"));
        Label c = new Label(chg);
        c.setTextFill(javafx.scene.paint.Color.web("#26a69a"));
        box.getChildren().addAll(s, p, c);
        return box;
    }

    // Renamed from loadData to fetchData to match the call in start()
    public void fetchData(String ticker, String timeframe) { // Changed to public for ControlPanel access
        chartPane.setStatus("Loading " + ticker + "...");
        new Thread(() -> {
            try {
                var data = apiClient.fetchData(ticker, timeframe);
                javafx.application.Platform.runLater(() -> {
                    chartPane.setData(data);
                });
            } catch (Exception e) {
                e.printStackTrace();
                String errorMsg = (e.getMessage() != null) ? e.getMessage() : e.getClass().getName();
                javafx.application.Platform.runLater(() -> {
                    chartPane.setStatus("Connection Error: " + errorMsg);
                });
            }
        }).start();
    }

    public ChartPane getChartPane() {
        return chartPane;
    }

    public static void main(String[] args) {
        launch(args);
    }
}

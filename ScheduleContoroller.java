import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/schedules")
public class ScheduleController {

    // テンプレート保存用API
    @PostMapping("/template")
    public String saveTemplate(@RequestBody TemplateRequest request) {
        // ここでデータベース(MySQLやPostgreSQLなど)に保存する
        System.out.println("テンプレート名: " + request.getTemplateName());
        for (PlanDto plan : request.getPlans()) {
            System.out.println("予定: " + plan.getTitle() + ", 開始: " + plan.getStartTotalMinutes() + "分, 長さ: " + plan.getDuration() + "分");
        }
        return "{\"status\": \"success\", \"message\": \"Template saved.\"}";
    }
}

// データを受け取るためのDTO（Data Transfer Object）クラス
class TemplateRequest {
    private String templateName;
    private List<PlanDto> plans;

    // ゲッター・セッター
    public String getTemplateName() { return templateName; }
    public void setTemplateName(String templateName) { this.templateName = templateName; }
    public List<PlanDto> getPlans() { return plans; }
    public void setPlans(List<PlanDto> plans) { this.plans = plans; }
}

class PlanDto {
    private String title;
    private int startTotalMinutes;
    private int duration;
    private String color;

    // ゲッター・セッター
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public int getStartTotalMinutes() { return startTotalMinutes; }
    public void setStartTotalMinutes(int startTotalMinutes) { this.startTotalMinutes = startTotalMinutes; }
    public int getDuration() { return duration; }
    public void setDuration(int duration) { this.duration = duration; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
}